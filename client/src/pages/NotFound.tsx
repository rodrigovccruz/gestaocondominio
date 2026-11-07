import { useEffect } from "react";

// A hospedagem responde /404 com status HTTP 404 e ainda serve o app.
const NOT_FOUND_PATH = "/404";

export default function NotFound() {
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    if (window.location.pathname.replace(/\/$/, "") !== NOT_FOUND_PATH)
      window.location.replace(NOT_FOUND_PATH);
    return () => robots.remove();
  }, []);

  return (
    <div className="page">
      <h1>Página não encontrada</h1>
      <a href="/">Voltar ao quadro</a>
    </div>
  );
}
