"""매뉴얼 맵 재생성 — 모든 기능 통합"""
import csv, os, re
from collections import OrderedDict
from urllib.parse import quote
import html as html_escape_mod

BASE     = r"Y:\!★ 신규 폴더 구조\1. 실 공통\2. 매뉴얼"
CSV      = r"D:\ngv_dashbord\Finance-Dashboard\data\manual_tree.csv"
OUT_HTML = r"\\10.206.32.3\기술교육팀\!★ 신규 폴더 구조\1. 실 공통\2. 매뉴얼\매뉴얼맵 및 운영 규칙.html"

MANUAL_EXT = {'.pptx','.ppt','.pdf','.docx','.doc','.xlsx','.xls','.hwp','.hwpx'}
CAT_DESCS  = {
    '1. 프로젝트': '프로젝트 사업계획, 제안, 착수, 중간, 완료 각 단계별 작성 가이드',
    '2. 체계수립(역량모델링) 및 교육 과정개발': '고객 요구 사항에 따른 교육 체계 수립 및 역량 모델링 컨설팅, 교육 과정 개발 및 강사 선정',
    '3. 교육 운영 및 결과 보고': '교육 형태에 따른 강사, 학습자, 교육 환경별 운영 진행',
    '4. 정부지원 사업': '정부지원 교육 사업별 각 운영 매뉴얼',
    '5. 매출 실적': '사내 매출/경비 실적 작성 안내 가이드',
}
CAT_DISPLAY = {}

# ── 데이터 로드 ──────────────────────────────────────────
with open(CSV, encoding='utf-8-sig') as f:
    all_rows = list(csv.DictReader(f))

def is_history(path):
    return 'history' in path.replace('\\', '/').lower().split('/')

rows = [r for r in all_rows
        if r['유형'] == '파일'
        and not r['Name'].startswith('~')
        and int(r['깊이']) <= 9
        and r['Extension'].lower() in MANUAL_EXT]

def rel_parts(full):
    rel = full.replace(BASE, '').lstrip('\\')
    return rel.split('\\')

def infer_desc(name, ext):
    n = re.sub(r'\.(pptx?|pdf|docx?|xlsx?|hwpx?)$', '', name, flags=re.I)
    n = re.sub(r'_v[\d.]+|_\d{6,}|[\[\]【】]', '', n)
    n = re.sub(r'\s+', ' ', n).strip()
    ext_label = {'.pptx':'PPT','.ppt':'PPT','.pdf':'PDF','.docx':'Word','.doc':'Word',
                 '.xlsx':'Excel','.xls':'Excel','.hwp':'한글','.hwpx':'한글'}.get(ext.lower(),'문서')
    kw = []
    if '매뉴얼' in n: kw.append('운영 매뉴얼')
    elif '가이드' in n: kw.append('가이드')
    elif '안내' in n: kw.append('안내 자료')
    elif 'OT' in n or '오리엔테이션' in n: kw.append('오리엔테이션')
    elif '양식' in n or '서식' in n: kw.append('양식/서식')
    elif '보고' in n: kw.append('보고 자료')
    elif '체계' in n: kw.append('체계 수립')
    elif '교육' in n: kw.append('교육 자료')
    elif '운영' in n: kw.append('운영 자료')
    elif '계획' in n: kw.append('계획서')
    elif '결과' in n: kw.append('결과 보고')
    desc = ', '.join(kw) if kw else ext_label + ' 문서'
    return f'[{ext_label}] {desc}'

# ── 그룹핑 — 깊이1 폴더 기준 (파일 없는 폴더도 포함) ────
EXCLUDE_CATS = {'99. 기타 매뉴얼'}  # 표시 제외 대분류

depth1_folders = sorted(
    [r['Name'] for r in all_rows
     if r['유형']=='폴더' and r['깊이']=='1' and r['Name'] not in EXCLUDE_CATS],
    key=lambda x: x
)
groups = OrderedDict()
for folder in depth1_folders:
    groups[folder] = []
for r in rows:
    parts = rel_parts(r['FullName'])
    cat1 = parts[0] if len(parts) > 1 else '기타'
    if cat1 in groups:
        groups[cat1].append(r)
    else:
        groups.setdefault(cat1, []).append(r)

# 빈 폴더의 하위 폴더 목록도 수집
empty_subfolders = {}
for cat1, cat_rows in groups.items():
    if len(cat_rows) == 0:
        subs = [r['Name'] for r in all_rows
                if r['유형']=='폴더'
                and r['깊이']=='2'
                and rel_parts(r['FullName'])[0] == cat1]
        empty_subfolders[cat1] = subs

ICON = {'.pptx':'🟧','.ppt':'🟧','.pdf':'🟥','.docx':'🟦','.doc':'🟦',
        '.xlsx':'🟩','.xls':'🟩','.hwp':'🟨','.hwpx':'🟨'}
EXT_COLOR = {'.pptx':'#FF6B35','.ppt':'#FF6B35','.pdf':'#E53E3E',
             '.docx':'#3182CE','.doc':'#3182CE',
             '.xlsx':'#38A169','.xls':'#38A169',
             '.hwp':'#D69E2E','.hwpx':'#D69E2E'}
CAT_BG = ['#EBF4FF','#E8F5E9','#FFF8E1','#FCE4EC','#EDE7F6']

# ── HTML 생성 ────────────────────────────────────────────
body_parts = []
for i, (cat1, cat_rows) in enumerate(groups.items()):
    cat_id   = f'cat{i}'
    display_name = CAT_DISPLAY.get(cat1, cat1)
    desc     = CAT_DESCS.get(cat1, '')
    bg_color = CAT_BG[i % len(CAT_BG)]

    body_parts.append(f'''
<div class="category">
  <div class="cat-header" onclick="toggle('{cat_id}')" style="background:{bg_color};">
    <span class="cat-icon">📂</span>
    <span class="cat-title">{display_name}</span>
    <span class="cat-desc">{desc}</span>
    <span class="cat-count">{len(cat_rows)}개</span>
    <span class="toggle-btn" id="btn-{cat_id}">▼</span>
  </div>
  <div class="cat-body" id="{cat_id}" style="display:none;">''')

    # 파일 없는 빈 폴더 처리
    if len(cat_rows) == 0:
        subs = empty_subfolders.get(cat1, [])
        if subs:
            for sf in subs:
                body_parts.append(f'''
    <div class="subcategory">
      <div class="sub-header" style="cursor:default;">
        <span>📁 {sf}</span>
        <span class="cat-count" style="background:#A0AEC0;">0개</span>
      </div>
    </div>''')
        else:
            body_parts.append('<div style="padding:16px;color:#A0AEC0;font-size:13px;">등록된 매뉴얼 파일이 없습니다.</div>')
        body_parts.append('  </div>\n</div>')
        continue

    sub = OrderedDict()
    for r in cat_rows:
        parts = rel_parts(r['FullName'])
        cat2 = parts[1] if len(parts) > 2 else ''
        sub.setdefault(cat2, []).append(r)

    for j, (cat2, sub_rows) in enumerate(sub.items()):
        sub_id = f'{cat_id}_sub{j}'
        if cat2:
            body_parts.append(f'''
    <div class="subcategory">
      <div class="sub-header" onclick="toggle('{sub_id}')">
        <span>📁 {cat2}</span>
        <span class="cat-count">{len(sub_rows)}개</span>
        <span class="toggle-btn" id="btn-{sub_id}">▼</span>
      </div>
      <div class="sub-body" id="{sub_id}" style="display:none;">''')

        # 깊이3 기준으로 추가 그룹핑
        cat3_groups = OrderedDict()
        for r in sub_rows:
            parts2 = rel_parts(r['FullName'])
            cat3 = parts2[2] if len(parts2) > 3 else ''
            cat3_groups.setdefault(cat3, []).append(r)

        for k, (cat3, cat3_rows) in enumerate(cat3_groups.items()):
            cat3_id = f'{sub_id}_s3{k}'
            if cat3:
                body_parts.append(f'''
        <div class="subcategory3">
          <div class="sub3-header" onclick="toggle('{cat3_id}')">
            <span>📂 {cat3}</span>
            <span class="cat-count">{len(cat3_rows)}개</span>
            <span class="toggle-btn" id="btn-{cat3_id}">▼</span>
          </div>
          <div class="sub-body" id="{cat3_id}" style="display:none;">''')

            def render_file(r, depth_offset=3):
                parts2 = rel_parts(r['FullName'])
                fname  = r['Name']
                ext    = r['Extension'].lower()
                icon   = ICON.get(ext, '📄')
                color  = EXT_COLOR.get(ext, '#718096')
                ext_l  = ext.lstrip('.').upper()
                desc2  = infer_desc(fname, ext)
                sub_path = ' › '.join(parts2[depth_offset:-1]) if len(parts2) > depth_offset + 1 else ''
                unc_path = r['FullName'].replace('Y:\\', '\\\\10.206.32.3\\기술교육팀\\', 1)
                file_url = 'file:' + unc_path.replace('\\', '/')
                file_url_safe = html_escape_mod.escape(file_url, quote=True)
                fname_safe = html_escape_mod.escape(fname)
                try:
                    size_kb = float(r['크기(KB)'])
                    size_str = f'{size_kb:,.0f} KB' if size_kb < 1024 else f'{size_kb/1024:.1f} MB'
                except:
                    size_str = ''
                return f'''
            <div class="file-item">
              <span class="file-icon">{icon}</span>
              <div class="file-info">
                <div class="file-name">
                  <a class="file-link" href="{file_url_safe}" download="{fname_safe}" title="{fname_safe}">{fname_safe}</a>
                </div>
                {f'<div class="file-subpath">📂 {sub_path}</div>' if sub_path else ''}
                <div class="file-meta">
                  <span class="badge" style="background:{color}">{ext_l}</span>
                  <span class="file-desc">{desc2}</span>
                  <span class="file-size">{size_str}</span>
                </div>
              </div>
            </div>'''

            # 깊이4 기준 추가 그룹핑 (history 등 하위 폴더 표현)
            cat4_groups = OrderedDict()
            for r in cat3_rows:
                parts2 = rel_parts(r['FullName'])
                cat4 = parts2[3] if len(parts2) > 4 else ''
                cat4_groups.setdefault(cat4, []).append(r)

            for m, (cat4, cat4_rows) in enumerate(cat4_groups.items()):
                cat4_id = f'{cat3_id}_s4{m}'
                if cat4:
                    body_parts.append(f'''
            <div class="subcategory4">
              <div class="sub4-header" onclick="toggle('{cat4_id}')">
                <span>📁 {cat4}</span>
                <span class="cat-count">{len(cat4_rows)}개</span>
                <span class="toggle-btn" id="btn-{cat4_id}">▼</span>
              </div>
              <div class="sub-body" id="{cat4_id}" style="display:none;">''')

                for r in cat4_rows:
                    body_parts.append(render_file(r, depth_offset=4 if cat4 else 3))

                if cat4:
                    body_parts.append('              </div>\n            </div>')

            if cat3:
                body_parts.append('          </div>\n        </div>')

        if cat2:
            body_parts.append('      </div>\n    </div>')

    body_parts.append('  </div>\n</div>')

html_body = ''.join(body_parts)
total_files = len(rows)
total_cats  = len(groups)

html_out = f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>매뉴얼 맵 및 운영 규칙 — 기술교육사업기획팀</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0;}}
body{{font-family:"Malgun Gothic","맑은 고딕",sans-serif;background:#F7F8FA;color:#2D3748;}}
.header{{background:linear-gradient(135deg,#2C4A6E,#3B6EA5);color:#fff;padding:28px 40px;}}
.header-inner{{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;}}
.header-left{{flex:1;min-width:0;}}
.header h1{{font-size:24px;font-weight:700;margin-bottom:4px;}}
.header p{{font-size:13px;opacity:.8;}}
.stats{{display:flex;gap:16px;flex-shrink:0;}}
.stat{{background:rgba(255,255,255,.15);border-radius:8px;padding:10px 18px;text-align:center;}}
.stat-num{{font-size:22px;font-weight:700;}}
.stat-lbl{{font-size:11px;opacity:.85;}}
.rules-wrap{{max-width:1200px;margin:20px auto 0;padding:0 24px;}}
.rules-box{{background:#EBF4FF;border:1.5px solid #BEE3F8;border-radius:10px;padding:14px 20px 14px 36px;}}
.rules-title{{font-size:13px;font-weight:700;color:#2C4A6E;margin-bottom:6px;}}
.rules-list{{color:#2D3748;font-size:13px;line-height:2;}}
.rules-list strong{{color:#2C4A6E;font-weight:700;}}
.toolbar{{background:#fff;padding:14px 40px;box-shadow:0 1px 4px rgba(0,0,0,.08);display:flex;align-items:center;gap:12px;flex-wrap:wrap;}}
.toolbar input{{flex:1;min-width:200px;max-width:480px;padding:9px 14px;border:1.5px solid #CBD5E0;border-radius:8px;font-size:13px;outline:none;}}
.toolbar input:focus{{border-color:#3B6EA5;}}
.ctrl-btn{{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border:none;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .18s;box-shadow:0 2px 6px rgba(0,0,0,.10);letter-spacing:.01em;}}
.ctrl-btn.expand{{background:linear-gradient(135deg,#3B6EA5,#2C4A6E);color:#fff;}}
.ctrl-btn.expand:hover{{background:linear-gradient(135deg,#4A80BB,#3B6EA5);box-shadow:0 4px 12px rgba(44,74,110,.30);transform:translateY(-1px);}}
.ctrl-btn.collapse{{background:#fff;color:#2C4A6E;border:1.5px solid #BEE3F8;}}
.ctrl-btn.collapse:hover{{background:#EBF4FF;border-color:#3B6EA5;box-shadow:0 4px 12px rgba(44,74,110,.12);transform:translateY(-1px);}}
.container{{max-width:1200px;margin:20px auto;padding:0 24px;}}
.category{{background:#fff;border-radius:12px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,.07);overflow:hidden;}}
.cat-header{{display:flex;align-items:center;gap:10px;padding:14px 18px;cursor:pointer;user-select:none;border-bottom:1px solid #BEE3F8;}}
.cat-header:hover{{filter:brightness(.97);}}
.cat-icon{{font-size:18px;}}
.cat-title{{font-size:15px;font-weight:700;color:#1A365D;white-space:nowrap;}}
.cat-desc{{font-size:12px;color:#4A6FA5;flex:1;border-left:2px solid #93B8DC;padding-left:10px;margin-left:4px;}}
.cat-count{{background:#3B6EA5;color:#fff;border-radius:10px;padding:1px 9px;font-size:11px;font-weight:600;white-space:nowrap;}}
.toggle-btn{{font-size:11px;color:#718096;transition:transform .2s;}}
.toggle-btn.open{{transform:rotate(180deg);}}
.cat-body{{padding:10px 14px;}}
.subcategory{{margin-bottom:8px;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;}}
.sub-header{{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#F7FAFC;cursor:pointer;font-size:13px;font-weight:600;color:#2D3748;user-select:none;}}
.sub-header span:first-child{{flex:1;}}
.sub-body{{padding:6px 10px;}}
.subcategory3{{margin:6px 0 6px 12px;border:1px solid #EDF2F7;border-radius:6px;overflow:hidden;}}
.sub3-header{{display:flex;align-items:center;gap:8px;padding:7px 12px;background:#F0F7FF;cursor:pointer;font-size:12px;font-weight:600;color:#2D3748;user-select:none;}}
.sub3-header span:first-child{{flex:1;}}
.subcategory4{{margin:4px 0 4px 12px;border:1px solid #F0F4F8;border-radius:5px;overflow:hidden;}}
.sub4-header{{display:flex;align-items:center;gap:8px;padding:6px 12px;background:#F7FAFC;cursor:pointer;font-size:12px;font-weight:500;color:#4A5568;user-select:none;}}
.sub4-header span:first-child{{flex:1;}}
.file-item{{display:flex;gap:10px;padding:7px 4px;border-bottom:1px solid #F0F4F8;align-items:flex-start;}}
.file-item:last-child{{border-bottom:none;}}
.file-icon{{font-size:16px;padding-top:2px;}}
.file-info{{flex:1;min-width:0;}}
.file-name{{font-size:13px;font-weight:500;word-break:break-all;line-height:1.4;}}
.file-link{{color:#2C4A6E;text-decoration:none;}}
.file-link:hover{{text-decoration:underline;color:#3B6EA5;}}
.file-subpath{{font-size:11px;color:#A0AEC0;margin-top:2px;}}
.file-meta{{display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;}}
.badge{{color:#fff;border-radius:4px;padding:1px 7px;font-size:11px;font-weight:700;}}
.file-desc{{font-size:12px;color:#718096;}}
.file-size{{font-size:11px;color:#A0AEC0;margin-left:auto;}}
footer{{text-align:center;padding:28px;color:#A0AEC0;font-size:12px;}}
#toast{{display:none;position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
       background:#2C4A6E;color:#fff;padding:14px 28px;border-radius:10px;
       font-size:13px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.25);
       white-space:pre-line;text-align:center;line-height:1.8;}}
</style>
</head>
<body>

<div class="header">
  <div class="header-inner">
    <div class="header-left">
      <h1>📋 매뉴얼 맵 및 운영 규칙</h1>
      <p>기술교육사업기획팀 · 공용 매뉴얼 폴더 현황</p>
      <p style="margin-top:4px;font-size:11px;opacity:.65;">경로: \\\\10.206.32.3\\기술교육팀\\!★ 신규 폴더 구조\\1. 실 공통\\2. 매뉴얼</p>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-num">{total_cats}</div><div class="stat-lbl">대분류</div></div>
      <div class="stat"><div class="stat-num">{total_files}</div><div class="stat-lbl">매뉴얼 파일</div></div>
    </div>
  </div>
</div>

<div class="toolbar">
  <input type="text" id="search" placeholder="파일명 키워드를 검색하여 빠르게 찾으세요." oninput="filterFiles(this.value)">
  <button class="ctrl-btn expand" onclick="expandAll()">▼ 전체 열기</button>
  <button class="ctrl-btn collapse" onclick="collapseAll()">▲ 전체 접기</button>
</div>

<div class="rules-wrap">
  <p class="rules-title" style="margin-bottom:8px;font-size:13px;font-weight:700;color:#2C4A6E;">📌 매뉴얼 관리 및 운영 규칙</p>
  <div class="rules-box">
    <ol class="rules-list">
      <li>업무 프로세스에 매칭되는 공통 업무 매뉴얼은 본 NAS 경로에 업데이트 및 관리합니다.</li>
      <li>매뉴얼은 항상 최신 매뉴얼만 유지하고, 참고를 위한 과거 버전은 본 폴더 내 <strong>history</strong>로 이동합니다.</li>
      <li>프로세스 1단계 ~ 5단계 폴더 구조 변경 필요 시 문의 바랍니다. 하위 폴더 구조는 변경 가능합니다.</li>
      <li>주요 업무 매뉴얼의 경우 내용 업데이트 시 <strong>제(개)정 이력</strong> 작성 바랍니다.</li>
    </ol>
  </div>
</div>

<div class="container">
{html_body}
</div>

<footer>생성일: 2026-08-06 · 기술교육사업기획팀</footer>
<div id="toast"></div>

<script>
function toggle(id) {{
  var el = document.getElementById(id);
  var btn = document.getElementById('btn-' + id);
  if (!el) return;
  if (el.style.display === 'none') {{
    el.style.display = 'block';
    if (btn) btn.classList.add('open');
  }} else {{
    el.style.display = 'none';
    if (btn) btn.classList.remove('open');
  }}
}}
function expandAll() {{
  document.querySelectorAll('.cat-body,.sub-body').forEach(function(el) {{ el.style.display = 'block'; }});
  document.querySelectorAll('.toggle-btn').forEach(function(b) {{ b.classList.add('open'); }});
}}
function collapseAll() {{
  document.querySelectorAll('.cat-body,.sub-body').forEach(function(el) {{ el.style.display = 'none'; }});
  document.querySelectorAll('.toggle-btn').forEach(function(b) {{ b.classList.remove('open'); }});
}}
function filterFiles(q) {{
  q = q.trim().toLowerCase();
  document.querySelectorAll('.file-item').forEach(function(item) {{
    var name = item.querySelector('.file-name').textContent.toLowerCase();
    item.style.display = (!q || name.indexOf(q) !== -1) ? '' : 'none';
  }});
  if (q) {{
    document.querySelectorAll('.cat-body,.sub-body').forEach(function(el) {{ el.style.display = 'block'; }});
    document.querySelectorAll('.toggle-btn').forEach(function(b) {{ b.classList.add('open'); }});
  }}
}}
</script>
</body>
</html>'''

with open(OUT_HTML, 'w', encoding='utf-8') as f:
    f.write(html_out)

print(f'완료 — {total_files}개 파일, {total_cats}개 대분류')
print(f'저장: {OUT_HTML}')
