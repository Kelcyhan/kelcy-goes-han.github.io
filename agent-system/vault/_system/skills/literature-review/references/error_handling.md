# Error Handling

## Search yields too few results
- Broaden queries: remove specificity, use single key terms
- Expand date range
- Try different phrasings and synonyms
- Search for the problem domain rather than specific methods
- Check if the topic uses different terminology in different communities

## Paper download fails
- Try alternate URL formats: `arxiv.org/abs/` → `arxiv.org/pdf/`
- Use Semantic Scholar PDF URL from search results
- If PDF unavailable, use `paper-analyzer` in **Mode B** (give it the paper name/arXiv ID and let it find and download the paper itself)
- As last resort, work from the abstract and search result metadata only — note this limitation in the analysis

## Paper-analyzer produces thin results
- The paper markdown may be poorly converted (tables, figures lost in PDF→MD conversion)
- Read the paper markdown yourself and supplement the analysis
- Check if key sections (methodology, results) are intact in the markdown

## Too many papers to analyze
- Prioritize: analyze the most-cited and most-relevant papers first
- For lower-priority papers, work from abstracts + search metadata rather than full analysis
- Group similar papers and analyze one representative deeply, others briefly
