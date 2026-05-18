import { ImageResponse } from "next/og";

export const ogImageAlt = "恋占いチャット｜月乃ミラ";

export const ogImageSize = { width: 1200, height: 630 };

const NOTO_SANS_JP_700_TTF =
  "https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFPYk75s.ttf";

export async function buildShareOgImage(): Promise<ImageResponse> {
  const fontData = await fetch(NOTO_SANS_JP_700_TTF).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          background: "linear-gradient(145deg, #f7f2ff 0%, #eee7ff 42%, #f0e8f5 100%)",
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#211a45",
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            fontFamily: '"Noto Sans JP"',
          }}
        >
          恋占いチャット
        </div>
        <div
          style={{
            fontSize: 38,
            marginTop: 12,
            color: "#8f7ae5",
            fontWeight: 700,
            fontFamily: '"Noto Sans JP"',
          }}
        >
          月乃ミラ
        </div>
        <div
          style={{
            fontSize: 28,
            marginTop: 40,
            color: "#5c5568",
            maxWidth: 920,
            lineHeight: 1.5,
            fontFamily: '"Noto Sans JP"',
            fontWeight: 700,
          }}
        >
          登録不要で3往復まで無料。眠れない恋の悩みを、いつでもチャットで。
        </div>
      </div>
    ),
    {
      ...ogImageSize,
      fonts: [{ name: "Noto Sans JP", data: fontData, style: "normal", weight: 700 }],
    },
  );
}
