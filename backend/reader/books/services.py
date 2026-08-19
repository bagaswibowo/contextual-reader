# Book processing services
import re
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
        book = epub.read_epub(file_path)
        chapters = []
        chapter_index = 0
        
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                content = item.get_content().decode('utf-8', errors='ignore')
                text = BookParser._clean_html(content)
                if text.strip() and len(text.strip()) > 30:
                    title = BookParser._extract_title(text) or f"Chapter {chapter_index + 1}"
                    chapters.append(ParsedChapter(
                        index=chapter_index,
                        title=title,
                        content=text
                    ))
                    chapter_index += 1
        return chapters if chapters else [ParsedChapter(0, "Chapter 1", "No text content found in EPUB.")]
    
    @staticmethod
    def _parse_txt(file_path: str) -> List[ParsedChapter]:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        parts = re.split(r'\n\s*\n', content)
        chapters = []
        for i, part in enumerate(parts):
            if part.strip() and len(part.strip()) > 20:
                chapters.append(ParsedChapter(
                    index=len(chapters),
                    title=f"Chapter {len(chapters) + 1}",
                    content=part.strip()
                ))
        return chapters if chapters else [ParsedChapter(0, "Chapter 1", content)]
    
    @staticmethod
    def _parse_pdf(file_path: str) -> List[ParsedChapter]:
        """Super fast PDF parsing with pdfplumber (0 OCR, sub-2s, 0 CPU lockup)"""
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

        # Group pages into chapters (every ~15 pages)
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
    
    @staticmethod
    def _clean_html(html_content: str) -> str:
        text = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL)
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    @staticmethod
    def _extract_title(text: str) -> str:
        first_line = text.split('\n')[0].strip()
        if len(first_line) < 50:
            return first_line
        return text[:30] + "..."


class SentenceSplitter:
    """Split chapter text into sentences with position tracking"""
    
    @staticmethod
    def split(text: str) -> List[ParsedSentence]:
        # Clean text
        text = re.sub(r'\s+', ' ', text)
        
        # Regex for sentence boundaries (. ! ?)
        pattern = r'(?<=[.!?])\s+'
        raw_sentences = re.split(pattern, text)
        
        sentences = []
        char_offset = 0
        
        for i, raw_sent in enumerate(raw_sentences):
            sent_text = raw_sent.strip()
            if not sent_text:
                continue
            
            start_pos = text.find(sent_text, char_offset)
            if start_pos == -1:
                start_pos = char_offset
            
            end_pos = start_pos + len(sent_text)
            char_offset = end_pos
            
            sentences.append(ParsedSentence(
                index=len(sentences),
                text=sent_text,
                start_char=start_pos,
                end_char=end_pos
            ))
        
        return sentences
