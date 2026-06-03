export function PageSkeleton() {
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* HUD bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          height: 52,
          flexShrink: 0,
          background: "var(--glass-lg)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="skeleton" style={{ width: 60, height: 22 }} />
          <div className="skeleton" style={{ width: 160, height: 28 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            className="skeleton"
            style={{ width: 160, height: 16, borderRadius: 99 }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="skeleton" style={{ width: 72, height: 28 }} />
          <div className="skeleton" style={{ width: 72, height: 28 }} />
          <div className="skeleton" style={{ width: 32, height: 28 }} />
        </div>
      </header>

      {/* 3-col body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* left col */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            background:
              "linear-gradient(180deg, rgba(11,15,28,0.97) 0%, rgba(8,11,22,0.98) 100%)",
            borderRight: "1px solid var(--border-subtle)",
            padding: "12px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div className="skeleton" style={{ width: "55%", height: 14 }} />
          {[90, 140, 110, 125, 105, 145].map((w, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ width: w, height: 34, borderRadius: 9 }}
            />
          ))}
        </div>

        {/* centre col */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          {/* orb zone */}
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 22,
              paddingBottom: 18,
              gap: 12,
              borderBottom: "1px solid rgba(78,205,196,0.12)",
            }}
          >
            <div
              className="skeleton"
              style={{ width: 220, height: 220, borderRadius: "50%" }}
            />
            <div
              className="skeleton"
              style={{ width: 240, height: 52, borderRadius: 6 }}
            />
          </div>

          {/* messages area */}
          <div
            style={{
              flex: 1,
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: 9 }}>
              <div
                className="skeleton"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
              <div
                className="skeleton"
                style={{
                  width: "65%",
                  height: 68,
                  borderRadius: "14px 14px 14px 3px",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                className="skeleton"
                style={{
                  width: "45%",
                  height: 44,
                  borderRadius: "14px 14px 3px 14px",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 9 }}>
              <div
                className="skeleton"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
              <div
                className="skeleton"
                style={{
                  width: "72%",
                  height: 88,
                  borderRadius: "14px 14px 14px 3px",
                }}
              />
            </div>
          </div>

          {/* input bar */}
          <div
            style={{
              padding: "10px 16px",
              flexShrink: 0,
              background: "var(--glass-lg)",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div
              className="skeleton"
              style={{ flex: 1, height: 42, borderRadius: 12 }}
            />
            <div
              className="skeleton"
              style={{ width: 40, height: 40, borderRadius: 11 }}
            />
            <div
              className="skeleton"
              style={{ width: 40, height: 40, borderRadius: 11 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
