"use client";
import { useState, useCallback, useEffect, useRef } from "react";

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif";

const CATEGORIES = [
  { id: "hbm", label: "HBM / 메모리", short: "HBM", accent: "#0A84FF", companies: ["SK하이닉스", "삼성전자", "마이크론"], query: "HBM memory SK Hynix Samsung Micron stock news 2026" },
  { id: "gpu", label: "GPU / NPU", short: "GPU", accent: "#30D158", companies: ["NVIDIA", "AMD", "퀄컴"], query: "NVIDIA AMD Qualcomm GPU NPU AI chip stock news 2026" },
  { id: "dc",  label: "데이터센터", short: "DC",  accent: "#BF5AF2", companies: ["Microsoft", "Google", "Meta"], query: "Microsoft Google Meta datacenter AI stock news 2026" },
  { id: "power", label: "전력 / 냉각", short: "전력", accent: "#FF9F0A", companies: ["Vertiv", "Eaton", "Vistra"], query: "Vertiv Eaton Vistra power cooling AI datacenter stock news 2026" },
  { id: "sw",  label: "AI 소프트웨어", short: "SW",  accent: "#FF375F", companies: ["Palantir", "Salesforce", "Snowflake"], query: "Palantir Salesforce Snowflake AI software stock news 2026" },
];

const BRIEF_PROMPT = `주식 투자자용 AI 섹터 분석가. 순수 JSON만 출력, 마크다운 없음.
{"summary":"1줄 요약","companies":[{"name":"기업명","signal":"bullish|bearish|neutral","headline":"핵심 한 줄","detail":"1-2줄","source":"출처","sourceUrl":"URL or ''"}],"outlook":"전망 한 줄"}
한국어.`;

const NEWS_PROMPT = `주식 투자자용 AI 뉴스 분석가. 순수 JSON만 출력, 마크다운 없음.
{"articles":[{"title":"제목","summary":"1줄 요약","source":"출처","url":"URL or ''","signal":"bullish|bearish|neutral","company":"기업명"}]}
최신 뉴스 4개만. 한국어.`;

const SIG = {
  bullish: { label: "호재", color: "#30D158", bg: "rgba(48,209,88,0.12)" },
  bearish: { label: "악재", color: "#FF375F", bg: "rgba(255,55,95,0.12)" },
  neutral: { label: "중립", color: "#8E8E93", bg: "rgba(142,142,147,0.12)" },
};

const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

async function callAPI(systemPrompt, message) {
  const res = await fetch("/api/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system: systemPrompt, message }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const clean = data.text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  if (start === -1) throw new Error("JSON 없음");
  for (let end = clean.lastIndexOf("}"); end > start; end = clean.lastIndexOf("}", end - 1)) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch {}
  }
  throw new Error("파싱 실패");
}

function Spinner({ color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", gap: 12 }}>
      <div style={{ width: 26, height: 26, border: "3px solid rgba(142,142,147,0.2)", borderTop: `3px solid ${color}`, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <span style={{ fontSize: 12, color: "#8E8E93" }}>분석 중...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Badge({ signal }) {
  const s = SIG[signal] || SIG.neutral;
  return <span style={{ fontSize: 11, fontWeight: 500, background: s.bg, color: s.color, padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>{s.label}</span>;
}

function Source({ source, url }) {
  if (!source) return null;
  return (
    <div style={{ marginTop: 6 }}>
      {url ? <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#0A84FF", textDecoration: "none" }}>{source}</a>
           : <span style={{ fontSize: 11, color: "#C7C7CC" }}>{source}</span>}
    </div>
  );
}

function RefreshBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#8E8E93", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: SF }}>
      <svg width="13" height="13" viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="#8E8E93" /></svg>
      새로고침
    </button>
  );
}

function CatBar({ activeCat, load, results }) {
  const cat = CATEGORIES.find(c => c.id === activeCat);
  return (
    <>
      <div style={{ padding: "0 16px", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => load(c)} style={{
              flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: activeCat === c.id ? 600 : 400, fontFamily: SF,
              background: activeCat === c.id ? cat.accent : "#F2F2F7",
              color: activeCat === c.id ? "#fff" : "#8E8E93",
            }}>
              {c.short}
              {results[c.id] && !results[c.id].error && activeCat !== c.id &&
                <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: c.accent, marginLeft: 5, verticalAlign: "middle" }} />}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "0 16px", marginBottom: 14, flexWrap: "wrap" }}>
        {cat.companies.map(co => (
          <span key={co} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "#F2F2F7", color: "#8E8E93", border: "0.5px solid #E5E5EA" }}>{co}</span>
        ))}
      </div>
    </>
  );
}

function useCatData(systemPrompt, buildMsg) {
  const [activeCat, setActiveCat] = useState(CATEGORIES[0].id);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const didInit = useRef(false);

  const load = useCallback(async (c, force = false) => {
    setActiveCat(c.id);
    if ((results[c.id] && !force) || loading[c.id]) return;
    if (force) setResults(p => ({ ...p, [c.id]: undefined }));
    setLoading(p => ({ ...p, [c.id]: true }));
    try {
      const parsed = await callAPI(systemPrompt, buildMsg(c));
      setResults(p => ({ ...p, [c.id]: parsed }));
    } catch (e) {
      setResults(p => ({ ...p, [c.id]: { error: true, msg: e.message } }));
    }
    setLoading(p => ({ ...p, [c.id]: false }));
  }, [results, loading, systemPrompt, buildMsg]);

  useEffect(() => {
    if (!didInit.current) { didInit.current = true; load(CATEGORIES[0]); }
  }, []);

  return { activeCat, results, loading, load };
}

function BriefingTab() {
  const { activeCat, results, loading, load } = useCatData(
    BRIEF_PROMPT,
    c => `오늘 기준 "${c.label}" 섹터 기업(${c.companies.join(", ")}) 주식 뉴스 분석. JSON만 출력.`
  );
  const cat = CATEGORIES.find(c => c.id === activeCat);
  const result = results[activeCat];
  const isLoading = !!loading[activeCat];

  return (
    <div>
      <CatBar activeCat={activeCat} load={load} results={results} />
      {isLoading && <Spinner color={cat.accent} />}
      {!isLoading && result && !result.error && (
        <div style={{ padding: "0 16px 24px" }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 10, border: "0.5px solid #E5E5EA" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: cat.accent, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>섹터 요약</p>
              <RefreshBtn onClick={() => load(cat, true)} />
            </div>
            <p style={{ fontSize: 14, color: "#1C1C1E", margin: "0 0 10px", lineHeight: 1.55 }}>{result.summary}</p>
            <div style={{ borderTop: "0.5px solid #E5E5EA", paddingTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
              <svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={cat.accent} /></svg>
              <span style={{ fontSize: 12, color: cat.accent, fontWeight: 500 }}>{result.outlook}</span>
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "0.5px solid #E5E5EA" }}>
            {result.companies?.map((co, i) => (
              <div key={i}>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1E" }}>{co.name}</span>
                    <Badge signal={co.signal} />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#1C1C1E", margin: "0 0 4px", lineHeight: 1.4 }}>{co.headline}</p>
                  <p style={{ fontSize: 13, color: "#8E8E93", margin: 0, lineHeight: 1.5 }}>{co.detail}</p>
                  <Source source={co.source} url={co.sourceUrl} />
                </div>
                {i < result.companies.length - 1 && <div style={{ height: "0.5px", background: "#E5E5EA", marginLeft: 16 }} />}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#C7C7CC", textAlign: "center", margin: "10px 0 0" }}>Claude 지식 기반 분석 · 투자 판단은 직접 검토하세요</p>
        </div>
      )}
      {!isLoading && result?.error && (
        <div style={{ margin: "0 16px", background: "#fff", borderRadius: 14, padding: "28px 16px", textAlign: "center", border: "0.5px solid #E5E5EA" }}>
          <p style={{ fontSize: 14, color: "#8E8E93", margin: "0 0 6px" }}>불러오지 못했습니다.</p>
          {result.msg && <p style={{ fontSize: 11, color: "#FF375F", margin: "0 0 12px" }}>{result.msg}</p>}
          <button onClick={() => load(cat, true)} style={{ fontSize: 13, padding: "8px 20px", borderRadius: 20, border: "none", background: cat.accent, color: "#fff", cursor: "pointer", fontFamily: SF }}>다시 시도</button>
        </div>
      )}
    </div>
  );
}

function NewsTab() {
  const { activeCat, results, loading, load } = useCatData(
    NEWS_PROMPT,
    c => `오늘 기준 "${c.label}" 섹터(${c.companies.join(", ")}) 최신 뉴스 4개. JSON만 출력.`
  );
  const cat = CATEGORIES.find(c => c.id === activeCat);
  const result = results[activeCat];
  const isLoading = !!loading[activeCat];

  return (
    <div>
      <CatBar activeCat={activeCat} load={load} results={results} />
      {isLoading && <Spinner color={cat.accent} />}
      {!isLoading && result && !result.error && (
        <div style={{ padding: "0 16px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#8E8E93" }}>뉴스 {result.articles?.length}건</span>
            <RefreshBtn onClick={() => load(cat, true)} />
          </div>
          <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "0.5px solid #E5E5EA" }}>
            {result.articles?.map((a, i) => (
              <div key={i}>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", margin: 0, lineHeight: 1.4, flex: 1 }}>{a.title}</p>
                    <Badge signal={a.signal} />
                  </div>
                  {a.company && <span style={{ fontSize: 11, color: cat.accent, fontWeight: 500, marginBottom: 4, display: "block" }}>{a.company}</span>}
                  <p style={{ fontSize: 13, color: "#8E8E93", margin: 0, lineHeight: 1.5 }}>{a.summary}</p>
                  <Source source={a.source} url={a.url} />
                </div>
                {i < result.articles.length - 1 && <div style={{ height: "0.5px", background: "#E5E5EA", marginLeft: 16 }} />}
              </div>
            ))}
          </div>
        </div>
      )}
      {!isLoading && result?.error && (
        <div style={{ margin: "0 16px", background: "#fff", borderRadius: 14, padding: "28px 16px", textAlign: "center", border: "0.5px solid #E5E5EA" }}>
          <p style={{ fontSize: 14, color: "#8E8E93", margin: "0 0 6px" }}>불러오지 못했습니다.</p>
          {result.msg && <p style={{ fontSize: 11, color: "#FF375F", margin: "0 0 12px" }}>{result.msg}</p>}
          <button onClick={() => load(cat, true)} style={{ fontSize: 13, padding: "8px 20px", borderRadius: 20, border: "none", background: cat.accent, color: "#fff", cursor: "pointer", fontFamily: SF }}>다시 시도</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [mainTab, setMainTab] = useState(0);
  return (
    <div style={{ fontFamily: SF, maxWidth: 390, margin: "0 auto", background: "#F2F2F7", minHeight: "100vh" }}>
      <div style={{ padding: "56px 20px 0", background: "#fff", borderBottom: "0.5px solid #E5E5EA" }}>
        <p style={{ fontSize: 12, color: "#8E8E93", margin: "0 0 3px" }}>{today}</p>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 14px", letterSpacing: -0.5, color: "#1C1C1E" }}>AI 마켓 브리핑</h1>
        <div style={{ display: "flex" }}>
          {["브리핑", "뉴스"].map((t, i) => (
            <button key={t} onClick={() => setMainTab(i)} style={{
              flex: 1, padding: "10px 0", border: "none", background: "transparent", cursor: "pointer", fontFamily: SF,
              fontSize: 14, fontWeight: mainTab === i ? 600 : 400,
              color: mainTab === i ? "#1C1C1E" : "#8E8E93",
              borderBottom: mainTab === i ? "2px solid #1C1C1E" : "2px solid transparent",
            }}>{t}</button>
          ))}
        </div>
      </div>
      <div style={{ paddingTop: 14 }}>
        {mainTab === 0 ? <BriefingTab /> : <NewsTab />}
      </div>
    </div>
  );
}
