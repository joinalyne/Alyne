import { AlyneWordmark } from '../components/AlyneWordmark';

const GOLD = "#A8893F";
const INK = "#2B2B2B";
const MUTED = "#8A8580";
const GREEN = "#1A3328";

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: GOLD,
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const steps = [
  {
    step: "1",
    title: "Tap Share",
    subtitle: "The share icon at the bottom of Safari.",
    icon: (
      <svg {...iconProps}>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    step: "2",
    title: "Add to Home Screen",
    subtitle: "Scroll down the menu to find it.",
    icon: (
      <svg {...iconProps}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M8 12h8" />
        <path d="M12 8v8" />
      </svg>
    ),
  },
  {
    step: "3",
    title: "Tap Add",
    subtitle: "Done — Alyne lives on your home screen.",
    icon: (
      <svg {...iconProps}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
];

export default function Install() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#FAF8F5",
      }}
    >
      <div style={{ width: "100%", maxWidth: 448, paddingTop: 48, paddingBottom: 40 }}>
         <div style={{ textAlign: "center", marginBottom: 24 }}>
          <AlyneWordmark className="w-24 mx-auto" />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: GOLD,
            }}
          />
          <span
            style={{
              color: GOLD,
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            One Quick Step
          </span>
        </div>

        <h1
          style={{
            textAlign: "center",
            marginBottom: 16,
            color: GREEN,
            fontSize: "2rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          Never miss a check-in.
        </h1>

        <p
          style={{
            textAlign: "center",
            margin: "0 auto 28px",
            color: INK,
            fontSize: "1rem",
            lineHeight: 1.65,
            maxWidth: 340,
          }}
        >
          Add Alyne to your home screen so your partner's check-ins reach you the
          moment they happen.
        </p>

        <div
          style={{
            marginBottom: 20,
            backgroundColor: "#FDF8EC",
            borderRadius: 18,
            padding: "20px 22px",
            border: "1px solid rgba(168,137,63,0.18)",
          }}
        >
          <p style={{ color: INK, fontSize: "0.9rem", lineHeight: 1.65 }}>
            <strong style={{ color: GOLD }}>First, make sure you're in Safari.</strong>{" "}
            Opened Alyne from Instagram, a text, or email? Tap the ··· or compass icon
            and choose "Open in Safari" — otherwise the step below won't appear.
          </p>
        </div>

        <div style={{ marginBottom: 32 }}>
          {steps.map(({ step, title, subtitle, icon }) => (
            <div
              key={step}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                backgroundColor: "#FFFFFF",
                borderRadius: 18,
                padding: 20,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  flexShrink: 0,
                  backgroundColor: "#F5F3F0",
                }}
              >
                {icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: INK, fontWeight: 600, fontSize: "1rem" }}>{title}</p>
                <p style={{ color: MUTED, fontSize: "0.875rem", marginTop: 2 }}>
                  {subtitle}
                </p>
              </div>
              <span
                style={{
                  color: "rgba(168,137,63,0.3)",
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {step}
              </span>
            </div>
          ))}
        </div>

        <p
          style={{
            textAlign: "center",
            margin: "0 auto",
            color: MUTED,
            fontSize: "0.85rem",
            lineHeight: 1.65,
            maxWidth: 320,
          }}
        >
          Takes about 10 seconds — and on iPhone it's the only way your check-in
          nudges can reach you.
        </p>
      </div>
    </div>
  );
}
