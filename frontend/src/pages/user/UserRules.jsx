import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert } from "../../components/DataState";

const renderContent = (content) =>
  String(content || "")
    .split("\n")
    .map((line, index) => {
      const value = line.trim();
      if (!value) return <br key={`br-${index}`} />;
      if (value.startsWith("-")) return <li key={`${value}-${index}`}>{value.replace(/^-+\s*/, "")}</li>;
      return <p key={`${value}-${index}`}>{value}</p>;
    });

export default function UserRules() {
  const [rules, setRules] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getRules().then(setRules).catch((err) => setError(err.message));
  }, []);

  return (
    <section className="page rules-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Quy định</p>
          <h1>Nội quy làm việc nhân viên</h1>
          <p className="page-subtitle">Các quy định do admin cập nhật cho nhân viên.</p>
        </div>
      </div>

      <Alert message={error} />

      <div className="rules-grid">
        {rules.length === 0 && <div className="panel task-board-empty">Chưa có nội quy.</div>}
        {rules.map((rule, index) => (
          <article className="panel rules-card" key={rule._id}>
            <span className="rules-card-index">{String(index + 1).padStart(2, "0")}</span>
            <h2>{rule.title}</h2>
            <div className="rules-content">{renderContent(rule.content)}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
