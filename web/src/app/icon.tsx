import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function AppIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "linear-gradient(135deg, #3a806b 0%, #2d6354 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 96,
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 220,
            fontWeight: 900,
            letterSpacing: -10,
            display: "flex",
          }}
        >
          CB
        </span>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
