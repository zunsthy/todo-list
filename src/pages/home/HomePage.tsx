export const HomePage = () => (
  <main className="home-page">
    <div className="module-list">
      <a className="module-card" href="/works">
        <h2>作品</h2>
        <p>沿时间轴查看作品发行与观看、阅读进度。</p>
        <span>打开作品时间轴 →</span>
      </a>
      <a className="module-card" href="/travel">
        <h2>足迹</h2>
        <p>按地区、时间和到访方式，回看自己的足迹。</p>
        <span>打开地区树 →</span>
      </a>
    </div>
  </main>
);
