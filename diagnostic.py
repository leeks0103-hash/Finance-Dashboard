import win32com.client
import os

FILES = [
    r"C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집\AI교육파트\(그룹사 현대로템) 26년_AX Acceleration 교육_AI_완료.pptx",
    r"C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집\AI교육파트\(그룹사 현대제철) 26년_바이브코딩 Fast Track 교육_AI_제안.pptx",
    r"C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집\AI교육파트\(협력사 경신전선) 26년_AI 교육_AI_착수.pptx",
]

KEYWORD = "재무관점 필수 데이터"

ppt = win32com.client.Dispatch("PowerPoint.Application")

for path in FILES:
    fname = os.path.basename(path)
    print(f"\n{'='*60}")
    print(f"파일: {fname}")

    if not os.path.exists(path):
        print("  파일 없음 (경로 확인 필요)")
        continue

    prs = None
    try:
        prs = ppt.Presentations.Open(path, True, False, False)
        print(f"  슬라이드 수: {prs.Slides.Count}")

        for si in range(1, prs.Slides.Count + 1):
            slide = prs.Slides(si)

            texts = []
            for i in range(1, slide.Shapes.Count + 1):
                try:
                    shp = slide.Shapes(i)
                    if shp.HasTextFrame and shp.TextFrame.HasText:
                        texts.append(shp.TextFrame.TextRange.Text[:50])
                except:
                    pass

            slide_text = " | ".join(texts)
            has_kw = KEYWORD in slide_text

            print(f"\n  [슬라이드 {si}] 키워드포함={has_kw}")
            print(f"    텍스트: {slide_text[:150]}")

            if not has_kw:
                continue

            for i in range(1, slide.Shapes.Count + 1):
                try:
                    shp = slide.Shapes(i)
                    if not shp.HasTable:
                        continue
                    t = shp.Table
                    print(f"\n    표 발견: {t.Rows.Count}행 x {t.Columns.Count}열")

                    for r in range(1, t.Rows.Count + 1):
                        row_vals = []
                        for c in range(1, t.Columns.Count + 1):
                            try:
                                val = t.Cell(r, c).Shape.TextFrame.TextRange.Text
                                row_vals.append(repr(val[:25]))
                            except Exception as e:
                                row_vals.append(f"ERR({type(e).__name__})")
                        print(f"    행{r}: {' | '.join(row_vals)}")
                except:
                    pass

    except Exception as e:
        print(f"  열기 실패: {e}")
    finally:
        if prs:
            try:
                prs.Close()
            except:
                pass

ppt.Quit()
print("\n완료")
