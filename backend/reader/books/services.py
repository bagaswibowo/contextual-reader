import logging
import zipfile
logger = logging.getLogger(__name__)
# Book processing services
import io
import os
import re
import json
import base64
import hashlib
import requests
import urllib.request
from django.conf import settings
import ebooklib
from ebooklib import epub
import pdfplumber
from collections import OrderedDict
import pypdfium2 as pdfium
from typing import List, Tuple
from dataclasses import dataclass


def _ocr_page_via_vlm(page_image_bytes: bytes) -> str:
    """olmOCR-style structured page transcription via Vision LLM"""
    try:
        b64_img = base64.b64encode(page_image_bytes).decode('utf-8')
        api_key = getattr(settings, 'OMNIROUTE_API_KEY', '') or os.environ.get('HERMES_CUSTOM_LOCALHOST_20128_API_KEY', '')
        base_url = getattr(settings, 'OMNIROUTE_BASE_URL', 'http://127.0.0.1:20128/v1')
        
        prompt = (
            "You are olmOCR, a high-precision document OCR engine.\n"
            "Task: Transcribe this document page into clean, readable Markdown.\n"
            "Rules:\n"
            "1. Linearize multi-column layouts into correct sequential reading order (read column 1 top-to-bottom, then column 2).\n"
            "2. Strip out running headers, running footers, and page numbers that interrupt reading flow.\n"
            "3. Format headings with appropriate Markdown (#, ##, ###).\n"
            "4. Convert tables into Markdown table format and math into inline LaTeX ($...$).\n"
            "5. De-hyphenate line breaks (e.g. 'struc- ture' -> 'structure').\n"
            "6. Output ONLY the clean Markdown text without conversational commentary."
        )
        
        req_data = {
            'model': 'antigravity/gemini-2.5-flash',
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{b64_img}'}}
                    ]
                }
            ],
            'max_tokens': 2500
        }
        
        req = urllib.request.Request(
            f'{base_url}/chat/completions',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            data=json.dumps(req_data).encode()
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode())
            return data['choices'][0]['message']['content'].strip()
    except Exception as e:
        print(f'VLM OCR Fallback error: {e}')
        return ''


@dataclass
class ParsedChapter:
    index: int
    title: str
    content: str


@dataclass
class ParsedSentence:
    index: int
    text: str
    start_char: int
    end_char: int


class LanguageDetector:
    """Auto-detect book language from sample text using frequency analysis + Google Translate GTX fallback"""

    COMMON_ID_WORDS = {'yang', 'dan', 'di', 'ini', 'dengan', 'untuk', 'pada', 'adalah', 'dari', 'ke', 'akan', 'atau', 'bisa', 'juga', 'perilaku', 'pengguna', 'sistem'}
    COMMON_EN_WORDS = {'the', 'and', 'to', 'of', 'a', 'in', 'is', 'that', 'for', 'it', 'as', 'was', 'with', 'be', 'by', 'on', 'are'}
    COMMON_ES_WORDS = {'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una'}

    @staticmethod
    def detect(sample_text: str) -> str:
        if not sample_text or len(sample_text.strip()) < 10:
            return "en"
        
        # Clean front-matter & copyright boilerplate
        cleaned = re.sub(r'copyright|all rights reserved|isbn|publisher|published|http\S+', '', sample_text, flags=re.I)
        words = set(re.findall(r'\b[a-z]{2,}\b', cleaned.lower()))

        # Direct fast frequency check for top languages
        id_score = len(words.intersection(LanguageDetector.COMMON_ID_WORDS))
        en_score = len(words.intersection(LanguageDetector.COMMON_EN_WORDS))
        es_score = len(words.intersection(LanguageDetector.COMMON_ES_WORDS))

        if id_score >= 3 and id_score > en_score and id_score > es_score:
            return "id"
        if es_score >= 3 and es_score > en_score and es_score > id_score:
            return "es"
        if en_score >= 3 and en_score > id_score:
            return "en"

        # Fallback to Google Translate GTX auto-detection
        params = {
            "client": "gtx",
            "sl": "auto",
            "tl": "en",
            "dt": "t",
            "q": cleaned[:500]
        }
        headers = {"User-Agent": "Mozilla/5.0"}
        try:
            res = requests.get("https://translate.googleapis.com/translate_a/single", params=params, headers=headers, timeout=5).json()
            if len(res) > 2 and isinstance(res[2], str) and res[2]:
                return res[2].lower()
            return "en"
        except Exception:
            return "en"


class BookParser:
    """Parse EPUB, PDF, TXT files into chapters and sentences"""
    
    @staticmethod
    def parse(file_path: str, format: str) -> List[ParsedChapter]:
        if format == 'epub':
            return BookParser._parse_epub(file_path)
        elif format == 'txt':
            return BookParser._parse_txt(file_path)
        elif format == 'pdf':
            return BookParser._parse_pdf(file_path)
        elif format == 'md':
            return BookParser._parse_md(file_path)
        elif format == 'zip':
            return BookParser._parse_zip(file_path)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    @staticmethod
    def _parse_epub(file_path: str) -> List[ParsedChapter]:
        chapters = []
        book = epub.read_epub(file_path)
        
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                content = item.get_content().decode('utf-8', errors='ignore')
                text = re.sub(r'<[^>]+>', ' ', content)
                text = re.sub(r'\s+', ' ', text).strip()
                
                if text and len(text) > 100:
                    title_match = re.search(r'<h[1-3][^>]*>(.*?)</h[1-3]>', content, re.IGNORECASE)
                    title = title_match.group(1) if title_match else f"Chapter {len(chapters) + 1}"
                    title = re.sub(r'<[^>]+>', '', title).strip()
                    
                    chapters.append(ParsedChapter(
                        index=len(chapters),
                        title=title or f"Chapter {len(chapters) + 1}",
                        content=text
                    ))
        
        if not chapters:
            all_text = []
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_DOCUMENT:
                    content = item.get_content().decode('utf-8', errors='ignore')
                    text = re.sub(r'<[^>]+>', ' ', content)
                    text = re.sub(r'\s+', ' ', text).strip()
                    if text:
                        all_text.append(text)
            
            full_text = " ".join(all_text)
            chapters = [ParsedChapter(index=0, title="Full Book", content=full_text)]
            
        return chapters

    @staticmethod
    def _parse_txt(file_path: str) -> List[ParsedChapter]:
        chapters = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='latin-1') as f:
                content = f.read()

        content = re.sub(r'\r\n', '\n', content)
        chapter_splits = re.split(r'\n(?=Chapter|\bCHAPTER\b|Bab|\bBAB\b)', content)
        
        if len(chapter_splits) > 1:
            for idx, ch_text in enumerate(chapter_splits):
                if not ch_text.strip():
                    continue
                lines = ch_text.strip().split('\n')
                title = lines[0][:100].strip() if lines else f"Chapter {idx + 1}"
                chapters.append(ParsedChapter(
                    index=len(chapters),
                    title=title,
                    content=ch_text.strip()
                ))
        else:
            chunk_size = 15000
            for i in range(0, len(content), chunk_size):
                chunk = content[i:i + chunk_size]
                chapters.append(ParsedChapter(
                    index=len(chapters),
                    title=f"Section {(i // chunk_size) + 1}",
                    content=chunk.strip()
                ))

        return chapters

    @staticmethod
    def _build_chapters_from_boundaries(boundaries: List[Tuple[int, str]], pages_text: List[str], total_pages: int) -> List[ParsedChapter]:
        chapters = []
        for i, (start_p, title) in enumerate(boundaries):
            end_p = boundaries[i + 1][0] if i + 1 < len(boundaries) else total_pages
            joined_text = "\n\n".join([pages_text[p] for p in range(start_p, end_p) if pages_text[p].strip()])
            if not joined_text.strip():
                joined_text = f"# {title}\n\n"
            chapters.append(ParsedChapter(
                index=len(chapters),
                title=title,
                content=joined_text
            ))
        return chapters

    @staticmethod
    def _split_markdown_chapters(content: str) -> List[ParsedChapter]:
        if not content.strip():
            return [ParsedChapter(0, "Document", "Empty Markdown content.")]

        # Find top-level headers outside fenced code blocks
        in_code_block = False
        header_matches = []
        for line_match in re.finditer(r'^(\s*```[a-zA-Z0-9_\-\s]*|#{1,2}[ \t]+(.+)$)', content, flags=re.MULTILINE):
            token = line_match.group(1)
            if token.startswith('```'):
                in_code_block = not in_code_block
            elif not in_code_block and line_match.group(2):
                header_matches.append((line_match.start(), line_match.group(2).strip()))

        if len(header_matches) >= 2:
            chapters = []
            if header_matches[0][0] > 0:
                preamble = content[:header_matches[0][0]].strip()
                if preamble:
                    chapters.append(ParsedChapter(index=0, title="Front Matter", content=preamble))
            for i, (start, title) in enumerate(header_matches):
                end = header_matches[i + 1][0] if i + 1 < len(header_matches) else len(content)
                chap_content = content[start:end].strip()
                chapters.append(ParsedChapter(index=len(chapters), title=title[:150], content=chap_content))
            return chapters

        return [ParsedChapter(0, "Full Book", content.strip())]

    @staticmethod
    def _parse_md(file_path: str) -> List[ParsedChapter]:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            full_text = f.read(25 * 1024 * 1024)
        return BookParser._split_markdown_chapters(full_text)

    @staticmethod
    def _parse_zip(file_path: str) -> List[ParsedChapter]:
        with zipfile.ZipFile(file_path, 'r') as zf:
            md_files = [m for m in zf.namelist() if m.lower().endswith('.md') and not m.startswith('__MACOSX') and not os.path.basename(m).startswith('.')]
            if not md_files:
                raise ValueError("No valid Markdown (.md) file found inside ZIP archive.")

            md_files.sort(key=lambda x: (0 if 'output' in x.lower() or 'main' in x.lower() else 1, len(x)))
            primary_md = md_files[0]
            with zf.open(primary_md) as f_in:
                content = f_in.read(25 * 1024 * 1024).decode('utf-8', errors='ignore')
            return BookParser._split_markdown_chapters(content)

    @staticmethod
    def _parse_pdf(file_path: str) -> List[ParsedChapter]:
        chapters = []
        pages_text = []
        
        media_img_dir = os.path.join(getattr(settings, 'MEDIA_ROOT', '/tmp'), 'book_images')
        os.makedirs(media_img_dir, exist_ok=True)
        book_prefix = hashlib.md5(file_path.encode()).hexdigest()[:8]
        
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                page_content = []
                try:
                    if page_num == 0 and len(pdf.pages) > 1:
                        # Academic Paper Page 1: separate abstract from left metadata sidebar
                        words = page.extract_words()
                        top_words = [w for w in words if w['top'] < 180]
                        top_title = ' '.join(w['text'] for w in sorted(top_words, key=lambda w: (round(w['top']/10), w['x0'])))
                        # Remove journal ISSN/DOI metadata from top title
                        top_title = re.sub(r'Journal for Lesson.*?(?=Contextual|Development|[A-Z][a-z]+)', '', top_title, flags=re.I).strip()
                        
                        # Right column abstract text (x0 >= 200)
                        abstract_words = [w for w in words if 180 <= w['top'] < 720 and w['x0'] >= 200]
                        abstract_text = ' '.join(w['text'] for w in sorted(abstract_words, key=lambda w: (round(w['top']/10), w['x0'])))
                        abstract_text = re.sub(r'A\s*B\s*S\s*T\s*R\s*A\s*K|A\s*B\s*S\s*T\s*R\s*A\s*C\s*T', '', abstract_text).strip()
                        
                        # Intro text at bottom of page 1
                        intro_words = [w for w in words if w['top'] >= 720]
                        intro_text = ' '.join(w['text'] for w in sorted(intro_words, key=lambda w: (round(w['top']/10), w['x0'])))
                        
                        p1_md = []
                        if top_title:
                            p1_md.append(f"# {top_title}\n")
                        if abstract_text:
                            p1_md.append(f"## Abstract\n{abstract_text}\n")
                        if intro_text:
                            p1_md.append(f"## Introduction\n{intro_text}\n")
                        page_content.append('\n\n'.join(p1_md))
                    else:
                        raw_text = page.extract_text(x_tolerance=2, y_tolerance=3) or ''
                        lines = raw_text.splitlines()
                        clean_lines = []
                        
                        # 1. Strip running headers, journal identifiers, DOIs, and page numbers
                        for line in lines:
                            l_str = line.strip()
                            if not l_str:
                                continue
                            if re.search(r'Journal for Lesson|P-ISSN|E-ISSN|Open Access|https?://|doi\.org|Vol\.\s*\d+,\s*No\.\s*\d+|Komang Nanda Cahyani|Article history|Received |Accepted |Available online|CC BY-SA|Copyright ©', l_str, re.I):
                                continue
                            if re.match(r'^\d+$', l_str):
                                continue
                            clean_lines.append(l_str)
                        
                        # 2. De-hyphenate words broken across lines and join paragraphs
                        page_text = '\n'.join(clean_lines)
                        page_text = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', page_text)
                        
                        paras = re.split(r'\n{2,}', page_text)
                        for p in paras:
                            joined = ' '.join(l.strip() for l in p.splitlines() if l.strip())
                            if re.match(r'^(1\.|2\.|3\.|4\.|5\.|6\.|7\.|I\.|II\.|III\.|IV\.|INTRODUCTION|METHOD|RESULTS|DISCUSSION|CONCLUSION|REFERENCES)', joined, re.I):
                                page_content.append(f"\n\n## {joined}\n\n")
                            elif len(joined) > 15:
                                page_content.append(joined)
                except Exception as e:
                    print(f"Error extracting text from PDF page {page_num}: {e}")
                
                # 3. Table Extraction (Grid + Borderless Academic Tables)
                try:
                    tables = page.extract_tables()
                    if not tables:
                        tables = page.extract_tables(table_settings={
                            'vertical_strategy': 'text',
                            'horizontal_strategy': 'lines',
                            'snap_tolerance': 4,
                            'join_tolerance': 4
                        })
                    if tables:
                        for tbl in tables:
                            clean_tbl = [[str(cell or '').replace('\n', ' ').strip() for cell in row] for row in tbl if any(row)]
                            if len(clean_tbl) >= 2 and len(clean_tbl[0]) >= 2:
                                header = clean_tbl[0]
                                rows = clean_tbl[1:]
                                md_table = []
                                md_table.append("| " + " | ".join(header) + " |")
                                md_table.append("| " + " | ".join(['---'] * len(header)) + " |")
                                for r in rows:
                                    padded = r + [''] * (len(header) - len(r))
                                    md_table.append("| " + " | ".join(padded[:len(header)]) + " |")
                                page_content.append("\n\n" + "\n".join(md_table) + "\n\n")
                except Exception as e:
                    print(f"Table extraction skipped on page {page_num}: {e}")

                # 4. Figure/Image Extraction
                try:
                    for img_idx, img_obj in enumerate(page.images):
                        w = img_obj.get('width', 0)
                        h = img_obj.get('height', 0)
                        if w >= 70 and h >= 40 and (w * h) >= 3500 and 'stream' in img_obj:
                            img_bytes = img_obj['stream'].get_data()
                            img_filename = f"{book_prefix}_p{page_num+1}_img{img_idx+1}.jpg"
                            img_path = os.path.join(media_img_dir, img_filename)
                            with open(img_path, 'wb') as f_img:
                                f_img.write(img_bytes)
                            img_url = f"/media/book_images/{img_filename}"
                            page_content.append(f"\n\n![Gambar Halaman {page_num+1}]({img_url})\n\n")
                except Exception as e:
                    logger.debug(f"Figure extraction skipped on page {page_num}: {e}")
                
                pages_text.append("\n\n".join(page_content) if page_content else "")
            
            # Scanned book fallback: AI Vision OCR via VLM
            valid_pages = sum(1 for p in pages_text if p.strip())
            if valid_pages < len(pdf.pages) * 0.3:
                # Enrich blank pages with AI Vision OCR without discarding non-blank text
                for page_num in range(min(50, len(pdf.pages))):
                    if not pages_text[page_num].strip():
                        try:
                            pil_img = pdf.pages[page_num].to_image(resolution=150).original
                            buf = io.BytesIO()
                            pil_img.save(buf, format="JPEG", quality=85)
                            ocr_text = _ocr_page_via_vlm(buf.getvalue())
                            if ocr_text:
                                pages_text[page_num] = ocr_text
                        except Exception as e:
                            logger.warning(f"AI Vision OCR failed on page {page_num}: {e}")
        
        if not any(p.strip() for p in pages_text):
            return [ParsedChapter(0, "Chapter 1", "No readable text content found in PDF.")]

        total_pages = len(pages_text)

        # Tier 1: Native PDF Bookmarks / Table of Contents via pypdfium2
        raw_toc = []
        try:
            doc = pdfium.PdfDocument(file_path)
            try:
                for b in doc.get_toc():
                    # Support both pypdfium2 v4+ dataclass and legacy API
                    p = getattr(b, 'page_index', None)
                    if p is None and hasattr(b, 'get_dest'):
                        dest = b.get_dest()
                        p = dest.get_index() if dest else None
                    raw_title = getattr(b, 'title', None) or (b.get_title() if hasattr(b, 'get_title') else "") or ""
                    t = re.sub(r"\s+", " ", str(raw_title)).strip()
                    lvl = getattr(b, 'level', 0)
                    if p is not None and t and 0 <= p < total_pages:
                        raw_toc.append((p, lvl, t))
            finally:
                doc.close()
        except Exception as e:
            logger.warning(f"Native PDF TOC extraction failed: {e}")

        if len(raw_toc) >= 2:
            grouped = OrderedDict()
            for p, lvl, t in raw_toc:
                if p not in grouped:
                    grouped[p] = []
                grouped[p].append(t)

            sorted_pages = sorted(grouped.keys())
            boundaries = []
            if sorted_pages[0] > 0:
                boundaries.append((0, "Front Matter"))
            for p in sorted_pages:
                title = " / ".join(grouped[p])[:150]
                boundaries.append((p, title))

            return BookParser._build_chapters_from_boundaries(boundaries, pages_text, total_pages)

        # Tier 2: Scan for Chapter headings across pages
        heading_pattern = re.compile(
            r"^(?:chapter|bab|part|bagian)\s+([0-9ivxlcdm]+|[a-z]+)\b(?::|\.|\s|-)*(.*)",
            re.IGNORECASE
        )
        detected_headings = []
        for p_idx, p_text in enumerate(pages_text):
            lines_p = [l.strip() for l in p_text.splitlines() if l.strip()][:5]
            for l in lines_p:
                m = heading_pattern.match(l)
                if m:
                    clean_title = re.sub(r"^#+\s*", "", l)[:100].strip()
                    detected_headings.append((p_idx, clean_title))
                    break

        if len(detected_headings) >= 2:
            boundaries = []
            if detected_headings[0][0] > 0:
                boundaries.append((0, "Front Matter"))
            for p_idx, title in detected_headings:
                boundaries.append((p_idx, title))

            return BookParser._build_chapters_from_boundaries(boundaries, pages_text, total_pages)

        # Tier 3: Fallback chunking by 15 pages
        chunk_size = 15
        for i in range(0, total_pages, chunk_size):
            chunk = [p for p in pages_text[i:i + chunk_size] if p.strip()]
            chapter_num = (i // chunk_size) + 1
            start_page = i + 1
            end_page = min(i + chunk_size, total_pages)

            title = f"Chapter {chapter_num} (Pages {start_page}-{end_page})"
            joined_text = "\n\n".join(chunk) if chunk else f"# Chapter {chapter_num}\n\n"
            chapters.append(ParsedChapter(
                index=len(chapters),
                title=title,
                content=joined_text
            ))

        return chapters


class SentenceSplitter:
    """Split chapter text into clean sentences with character offsets, protecting abbreviations, images, tables, & formulas"""
    
    ABBREVIATIONS = (
        'dr', 'mr', 'mrs', 'ms', 'prof', 'sr', 'jr', 'vs', 'etc', 'vol', 'no', 'pp', 'p',
        'et al', 'i.e', 'e.g', 'fig', 'tab', 'ed', 'approx', 'dept', 'univ', 'co', 'inc', 'corp'
    )
    
    @staticmethod
    def split(text: str) -> List[ParsedSentence]:
        if not text or not text.strip():
            return []
            
        # 1. Line-by-line block segmentation for Tables, Images, Headings, Formulas
        lines = text.split('\n')
        raw_blocks = []
        current_table = []
        current_text = []
        
        for line in lines:
            l = line.strip()
            # Table row
            if l.startswith('|') and l.endswith('|'):
                if current_text:
                    raw_blocks.append('\n'.join(current_text))
                    current_text = []
                current_table.append(l)
            # Standalone image markdown
            elif l.startswith('![') and l.endswith(')'):
                if current_table:
                    raw_blocks.append('\n'.join(current_table))
                    current_table = []
                if current_text:
                    raw_blocks.append('\n'.join(current_text))
                    current_text = []
                raw_blocks.append(l)
            else:
                if current_table:
                    raw_blocks.append('\n'.join(current_table))
                    current_table = []
                if l:
                    current_text.append(l)
                    
        if current_table:
            raw_blocks.append('\n'.join(current_table))
        if current_text:
            raw_blocks.append('\n'.join(current_text))
            
        sentences = []
        current_offset = 0
        
        for block in raw_blocks:
            b_str = block.strip()
            if not b_str:
                continue
                
            # Keep table or image as a single atomic unit
            if b_str.startswith('|') or (b_str.startswith('![') and b_str.endswith(')')) or (b_str.startswith('#') and len(b_str) < 150):
                start_char = text.find(b_str, current_offset)
                if start_char == -1:
                    start_char = current_offset
                end_char = start_char + len(b_str)
                current_offset = end_char
                sentences.append(ParsedSentence(
                    index=len(sentences),
                    text=b_str,
                    start_char=start_char,
                    end_char=end_char
                ))
                continue
                
            # Mask dots in abbreviations and decimals for normal text
            masked = re.sub(r'(\d+)\.(\d+)', r'\1<DOT>\2', b_str)
            for abbr in SentenceSplitter.ABBREVIATIONS:
                pattern = re.compile(rf'\b({re.escape(abbr)})\.', re.IGNORECASE)
                masked = pattern.sub(r'\1<DOT>', masked)
                
            raw_chunks = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9"\'\(\[\#]|\n)', masked)
            for chunk in raw_chunks:
                unmasked = chunk.replace('<DOT>', '.').strip()
                if not unmasked or len(unmasked) < 2:
                    continue
                    
                start_char = text.find(unmasked, current_offset)
                if start_char == -1:
                    start_char = current_offset
                end_char = start_char + len(unmasked)
                current_offset = end_char
                
                sentences.append(ParsedSentence(
                    index=len(sentences),
                    text=unmasked,
                    start_char=start_char,
                    end_char=end_char
                ))
            
        return sentences
