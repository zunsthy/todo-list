export const HomePage = () => (
  <main className="home-page">
    <h1>可视化记录</h1>
    <p>用适合的方式，查看自己的收藏与经历。</p>
    <div className="module-list">
      <a className="module-card" href="/works">
        <h2>作品</h2>
        <p>沿时间轴查看作品发行与观看、阅读进度。</p>
        <span>打开作品时间轴 →</span>
      </a>
      <section className="module-card" data-planned="true">
        <h2>旅行足迹</h2>
        <p>按地区、时间和到访方式，回看自己的足迹。</p>
        <span>规划中</span>
      </section>
    </div>
  </main>
);
