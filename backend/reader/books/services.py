import posixpath
from lxml import html as lxml_html
import html
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
    page_number: int = 1
    level: int = 0


WORDS_PER_PAGE_ESTIMATE = 250


def extract_epub_item_text(raw_html, anchor: str = None) -> str:
    """Extract clean text content from EPUB HTML using DOM traversal with safe no-network parser"""
    if not raw_html:
        return ""
    try:
        raw_bytes = raw_html.encode('utf-8') if isinstance(raw_html, str) else raw_html
        parser = lxml_html.HTMLParser(encoding='utf-8', remove_comments=True, no_network=True)
        tree = lxml_html.fromstring(raw_bytes, parser=parser)
        for el in tree.xpath('//script|//style'):
            el.drop_tree()

        if anchor:
            nodes = tree.xpath('//*[@id=$aid or @name=$aid]', aid=anchor)
            if nodes:
                target = nodes[0]
                # If target is a block container (div/section/article/etc.), its text_content is the chapter
                if len(target) > 0 or target.tag in ('div', 'section', 'article', 'main'):
                    txt = target.text_content()
                    if txt and len(txt.strip()) > 20:
                        return re.sub(r'\s+', ' ', txt).strip()

                # If target is a heading or inline anchor, collect siblings until next section/heading
                elements = [target]
                for sib in target.itersiblings():
                    if sib.get('id') or sib.get('name') or sib.tag in ('h1', 'h2', 'h3', 'section'):
                        break
                    elements.append(sib)
                txt = " ".join(el.text_content() for el in elements).strip()
                if len(txt) > 20:
                    return re.sub(r'\s+', ' ', txt)

        txt = tree.text_content()
        return re.sub(r'\s+', ' ', txt).strip()
    except Exception as e:
        logger.warning(f"Failed to parse EPUB HTML with lxml, falling back to regex: {e}")
        text_str = raw_html.decode('utf-8', errors='ignore') if isinstance(raw_html, bytes) else raw_html
        cleaned = re.sub(r'<[^>]+>', ' ', text_str)
        cleaned = html.unescape(cleaned)
        return re.sub(r'\s+', ' ', cleaned).strip()

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
    def _parse_epub_by_documents(book) -> List[ParsedChapter]:
        chapters = []
        cum_words = 0
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                raw_html = item.get_content()
                text = extract_epub_item_text(raw_html)
                if text and len(text) > 100:
                    raw_str = raw_html.decode('utf-8', errors='ignore')
                    title_match = re.search(r'<h[1-3][^>]*>(.*?)</h[1-3]>', raw_str, re.IGNORECASE)
                    title = title_match.group(1) if title_match else f"Chapter {len(chapters) + 1}"
                    title = html.unescape(re.sub(r"<[^>]+>", "", title)).strip()
                    w_count = len(text.split())
                    calc_page = max(1, 1 + (cum_words // WORDS_PER_PAGE_ESTIMATE))
                    chapters.append(ParsedChapter(
                        index=len(chapters),
                        title=title or f"Chapter {len(chapters) + 1}",
                        content=text,
                        page_number=calc_page,
                        level=0
                    ))
                    cum_words += w_count

        if not chapters:
            all_text = []
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_DOCUMENT:
                    text = extract_epub_item_text(item.get_content())
                    if text:
                        all_text.append(text)
            full_text = " ".join(all_text)
            chapters = [ParsedChapter(index=0, title="Full Book", content=full_text, page_number=1, level=0)]

        return chapters

    @staticmethod
    def _parse_epub(file_path: str) -> List[ParsedChapter]:
        book = epub.read_epub(file_path)

        def _flatten_toc(toc_list, level=0):
            items = []
            for it in toc_list:
                if isinstance(it, tuple):
                    sec, children = it
                    s_title = getattr(sec, 'title', '') or ''
                    s_href = getattr(sec, 'href', '') or ''
                    if s_title:
                        items.append((s_title, s_href, level))
                    items.extend(_flatten_toc(children, level + 1))
                elif isinstance(it, epub.Link):
                    items.append((getattr(it, 'title', '') or '', getattr(it, 'href', '') or '', level))
            return items

        flat_toc = _flatten_toc(book.toc) if hasattr(book, 'toc') and book.toc else []

        if flat_toc:
            chapters = []
            cum_words = 0
            doc_map = {posixpath.normpath(item.get_name()): item for item in book.get_items() if item.get_type() == ebooklib.ITEM_DOCUMENT}

            for idx, (title, href, level) in enumerate(flat_toc):
                parts = href.split('#', 1)
                file_href = posixpath.normpath(parts[0])
                anchor = parts[1] if len(parts) > 1 else None

                doc_item = doc_map.get(file_href)
                if not doc_item:
                    for k, v in doc_map.items():
                        if k == file_href or k.endswith('/' + file_href):
                            doc_item = v
                            break

                text = ""
                if doc_item:
                    text = extract_epub_item_text(doc_item.get_content(), anchor=anchor)

                if not text.strip():
                    text = f"# {title}\n\n"

                w_count = len(text.split())
                calc_page = max(1, 1 + (cum_words // WORDS_PER_PAGE_ESTIMATE))
                chapters.append(ParsedChapter(
                    index=len(chapters),
                    title=title or f"Chapter {len(chapters) + 1}",
                    content=text,
                    page_number=calc_page,
                    level=level
                ))
                cum_words += w_count

            if chapters:
                return chapters

        return BookParser._parse_epub_by_documents(book)

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
    def _build_chapters_from_boundaries(boundaries: List[Tuple], pages_text: List[str], total_pages: int) -> List[ParsedChapter]:
        chapters = []
        n = len(boundaries)
        local_pages = list(pages_text)

        for i in range(n):
            item = boundaries[i]
            if len(item) == 3:
                start_p, lvl, title = item
            else:
                start_p, title = item
                lvl = 0

            if i + 1 < n and boundaries[i + 1][0] == start_p:
                next_title = boundaries[i + 1][2] if len(boundaries[i + 1]) == 3 else boundaries[i + 1][1]
                p_text = local_pages[start_p] if 0 <= start_p < total_pages else ""
                idx_split = p_text.lower().find(next_title.lower()) if next_title else -1
                if idx_split > 0:
                    joined_text = p_text[:idx_split].strip()
                    local_pages[start_p] = p_text[idx_split:].strip()
                else:
                    joined_text = f"# {title}\n\n"
            else:
                end_p = boundaries[i + 1][0] if i + 1 < n else total_pages
                slice_pages = [local_pages[p] for p in range(start_p, max(start_p + 1, end_p)) if 0 <= p < total_pages and local_pages[p].strip()]
                joined_text = "\n\n".join(slice_pages)

            if not joined_text.strip():
                joined_text = f"# {title}\n\n"

            chapters.append(ParsedChapter(
                index=len(chapters),
                title=title,
                content=joined_text,
                page_number=start_p + 1,
                level=lvl
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
            if token.strip().startswith('```'):
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
        
        pdfium_doc = None
        total_extracted_images = 0
        MAX_IMAGES_PER_BOOK = 200

        try:
            try:
                pdfium_doc = pdfium.PdfDocument(file_path)
            except Exception as e:
                logger.warning(f"Failed to open PDF with pdfium for image extraction: {e}")

            with pdfplumber.open(file_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    page_content = []
                    try:
                        text = page.extract_text(layout=False) or ""
                        if text.strip():
                            text = re.sub(r"(\w+)-\n(\w+)", r"\1\2", text)
                            text = re.sub(r"[ \t]+", " ", text)
                            lines = [line.strip() for line in text.split("\n") if line.strip()]
                            text = "\n".join(lines)
                            page_content.append(text)
                    except Exception as e:
                        logger.debug(f"Text extraction failed on page {page_num}: {e}")

                    # 3. Table Extraction
                    try:
                        tables = page.extract_tables()
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
                        logger.debug(f"Table extraction skipped on page {page_num}: {e}")

                    # 4. Figure/Image Extraction via pypdfium2 native decoder with resource limits
                    if pdfium_doc and total_extracted_images < MAX_IMAGES_PER_BOOK:
                        try:
                            p_doc = pdfium_doc[page_num]
                            pw, ph = p_doc.get_width(), p_doc.get_height()
                            try:
                                img_count = 0
                                for obj in p_doc.get_objects():
                                    if total_extracted_images >= MAX_IMAGES_PER_BOOK:
                                        break
                                    if obj.type == pdfium.raw.FPDF_PAGEOBJ_IMAGE:
                                        try:
                                            # Filter out full-page raster scans (backgrounds)
                                            l, b_pos, r, t = obj.get_pos()
                                            cov_w = (r - l) / pw if pw > 0 else 0
                                            cov_h = (t - b_pos) / ph if ph > 0 else 0
                                            if cov_w >= 0.85 and cov_h >= 0.85:
                                                continue

                                            bitmap = obj.get_bitmap()
                                            pil_img = bitmap.to_pil()
                                            w, h = pil_img.size
                                            if w >= 70 and h >= 40 and (w * h) >= 3500:
                                                img_count += 1
                                                total_extracted_images += 1
                                                img_filename = f"{book_prefix}_p{page_num+1}_img{img_count}.jpg"
                                                img_path = os.path.join(media_img_dir, img_filename)
                                                if pil_img.mode != 'RGB':
                                                    pil_img = pil_img.convert('RGB')
                                                pil_img.save(img_path, format="JPEG", quality=85, optimize=True)
                                                img_url = f"/media/book_images/{img_filename}"

                                                # Extract real figure caption if present on page
                                                cap_match = re.search(r"((?:Figure|Fig\.|Gambar)\s+\d+[\.\d]*[^\n\.\:]*[\:\.][^\n]{1,80})", text, re.IGNORECASE)
                                                img_label = cap_match.group(1).strip() if cap_match else f"Gambar Halaman {page_num+1}"
                                                page_content.append(f"\n\n![{img_label}]({img_url})\n\n")
                                        except Exception as img_err:
                                            logger.debug(f"Single image decode error on page {page_num}: {img_err}")
                            finally:
                                p_doc.close()
                        except Exception as e:
                            logger.debug(f"Figure extraction skipped on page {page_num}: {e}")
                    pages_text.append("\n\n".join(page_content) if page_content else "")

                # Scanned book fallback: AI Vision OCR via VLM
                valid_pages = sum(1 for p in pages_text if p.strip())
                if valid_pages < len(pdf.pages) * 0.3:
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
        finally:
            if pdfium_doc:
                try:
                    pdfium_doc.close()
                except Exception:
                    pass

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
            sorted_toc = sorted(raw_toc, key=lambda x: (x[0], x[1]))
            boundaries = []
            if sorted_toc[0][0] > 0:
                boundaries.append((0, 0, "Front Matter"))
            for p, lvl, t in sorted_toc:
                boundaries.append((p, lvl, t[:150]))

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
                boundaries.append((0, 0, "Front Matter"))
            for p_idx, title in detected_headings:
                boundaries.append((p_idx, 0, title))

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
                content=joined_text,
                page_number=start_page,
                level=0
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
        current_math = []
        in_math_block = False

        def _flush_table():
            nonlocal current_table
            if current_table:
                raw_blocks.append('\n'.join(current_table))
                current_table = []

        def _flush_text():
            nonlocal current_text
            if current_text:
                raw_blocks.append('\n'.join(current_text))
                current_text = []

        def _flush_buffers():
            _flush_table()
            _flush_text()

        for line in lines:
            l = line.strip()
            # Handle multi-line math block state machine
            if in_math_block:
                current_math.append(line)
                if l.endswith('$$') or l.endswith('\\]'):
                    in_math_block = False
                    raw_blocks.append('\n'.join(current_math))
                    current_math = []
                continue

            # Precise math block detection (prevents swallow-up if closing delimiter is on same line)
            is_single_line_math = (l.startswith('$$') and l.endswith('$$') and len(l) > 2) or \
                                  (l.startswith('\\[') and l.endswith('\\]') and len(l) >= 4)
            has_closing_on_line = ('$$' in l[2:]) if l.startswith('$$') else ('\\]' in l[2:])
            is_math_open = (l.startswith('$$') or l.startswith('\\[')) and not has_closing_on_line

            if is_single_line_math:
                _flush_buffers()
                raw_blocks.append(l)
                continue
            elif is_math_open:
                _flush_buffers()
                in_math_block = True
                current_math.append(line)
                continue

            # Table row
            if l.startswith('|') and l.endswith('|'):
                _flush_text()
                current_table.append(l)
            # Standalone image
            elif l.startswith('![') and l.endswith(')'):
                _flush_buffers()
                raw_blocks.append(l)
            else:
                _flush_table()
                if l:
                    current_text.append(l)

        if in_math_block and current_math:
            raw_blocks.append('\n'.join(current_math))
        _flush_buffers()

        def _is_atomic_block(b: str) -> bool:
            return (
                b.startswith('|') or
                (b.startswith('![') and b.endswith(')')) or
                (b.startswith('$$') and b.endswith('$$') and len(b) > 2) or
                (b.startswith('\\[') and b.endswith('\\]') and len(b) > 2) or
                (b.startswith('#') and len(b) < 150)
            )

        sentences = []
        current_offset = 0

        for block in raw_blocks:
            b_str = block.strip()
            if not b_str:
                continue

            # Keep table, image, math block, or heading as a single atomic unit
            if _is_atomic_block(b_str):
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
