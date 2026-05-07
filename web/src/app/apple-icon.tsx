import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "linear-gradient(135deg, #3a806b 0%, #2d6354 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 78,
            fontWeight: 900,
            letterSpacing: -4,
            display: "flex",
          }}
        >
          CB
        </span>
      </div>
    ),
    { width: 180, height: 180 },
  );
}
