# Book processing services
import re
import requests
import ebooklib
from ebooklib import epub
import pdfplumber
from typing import List, Tuple
from dataclasses import dataclass


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
        
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                try:
                    text = page.extract_text()
                    if text and len(text.strip()) > 20:
                        pages_text.append(text.strip())
                except Exception as e:
                    print(f"Error extracting text from PDF page {page_num}: {e}")
        
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
    """Split chapter text into clean sentences with character offsets"""
    
    @staticmethod
    def split(text: str) -> List[ParsedSentence]:
        sentences = []
        raw_sentences = re.split(r'(?<=[.!?])\s+', text)
        
        current_offset = 0
        for idx, sent in enumerate(raw_sentences):
            sent_clean = sent.strip()
            if not sent_clean:
                continue
                
            start_char = text.find(sent_clean, current_offset)
            if start_char == -1:
                start_char = current_offset
                
            end_char = start_char + len(sent_clean)
            current_offset = end_char
            
            sentences.append(ParsedSentence(
                index=len(sentences),
                text=sent_clean,
                start_char=start_char,
                end_char=end_char
            ))
            
        return sentences
