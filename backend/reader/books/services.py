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
                    print(f"Figure extraction skipped on page {page_num}: {e}")
                
                if page_content:
                    pages_text.append("\n\n".join(page_content))
            
            # Scanned book fallback: AI Vision OCR via VLM
            if not pages_text or len(pages_text) < len(pdf.pages) * 0.3:
                for page_num, page in enumerate(pdf.pages[:30]):
                    try:
                        pil_img = page.to_image(resolution=150).original
                        buf = io.BytesIO()
                        pil_img.save(buf, format="JPEG", quality=85)
                        ocr_text = _ocr_page_via_vlm(buf.getvalue())
                        if ocr_text:
                            pages_text.append(ocr_text)
                    except Exception as e:
                        print(f"AI Vision OCR failed on page {page_num}: {e}")
        
        if not pages_text:
            return [ParsedChapter(0, "Chapter 1", "No readable text content found in PDF.")]

        chunk_size = 15
        for i in range(0, len(pages_text), chunk_size):
            chunk = pages_text[i:i + chunk_size]
            chapter_num = (i // chunk_size) + 1
            start_page = i + 1
            end_page = min(i + chunk_size, len(pages_text))
            
            title = f"Chapter {chapter_num} (Pages {start_page}-{end_page})"
            content = "\n\n".join(chunk)
            chapters.append(ParsedChapter(
                index=len(chapters),
                title=title,
                content=content
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
