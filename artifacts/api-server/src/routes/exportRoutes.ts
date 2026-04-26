import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { booksTable, chaptersTable } from "@workspace/db";

const router = Router();

router.get("/books/:id/export/:format", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const format = req.params.format as string;

  if (!["md", "docx", "pdf", "epub"].includes(format)) {
    res.status(400).json({ error: "Unsupported format. Use md, docx, pdf, or epub." });
    return;
  }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, id));
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  const chapters = await db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, id))
    .orderBy(chaptersTable.chapterNumber);

  const generatedChapters = chapters.filter((c) => c.generatedText);

  if (format === "md") {
    const mdContent = buildMarkdown(book, generatedChapters);
    const filename = sanitizeFilename(book.title) + ".md";
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(mdContent);
    return;
  }

  if (format === "docx") {
    try {
      const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");
      const docChildren: Paragraph[] = [];

      docChildren.push(
        new Paragraph({ text: book.title, heading: HeadingLevel.TITLE })
      );

      if (book.logline) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: book.logline, italics: true })],
            spacing: { after: 400 },
          })
        );
      }

      for (const ch of generatedChapters) {
        docChildren.push(
          new Paragraph({
            text: ch.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400 },
          })
        );
        const paragraphs = (ch.generatedText ?? "").split(/\n\n+/);
        for (const para of paragraphs) {
          if (para.trim()) {
            docChildren.push(
              new Paragraph({ text: para.trim(), spacing: { after: 120 } })
            );
          }
        }
      }

      const doc = new Document({ sections: [{ children: docChildren }] });
      const buffer = await Packer.toBuffer(doc);
      const filename = sanitizeFilename(book.title) + ".docx";
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      req.log.error({ err }, "DOCX generation failed");
      res.status(500).json({ error: "DOCX generation failed" });
    }
    return;
  }

  if (format === "pdf") {
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

      const pdfDoc = await PDFDocument.create();
      const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

      const pageWidth = 595.28; // A4
      const pageHeight = 841.89;
      const marginX = 72;
      const marginY = 72;
      const maxWidth = pageWidth - marginX * 2;
      const bodySize = 11;
      const lineHeight = bodySize * 1.6;

      const addPage = () => {
        const p = pdfDoc.addPage([pageWidth, pageHeight]);
        return { page: p, y: pageHeight - marginY };
      };

      const wrapText = (text: string, font: typeof timesFont, size: number, maxW: number): string[] => {
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let current = "";
        for (const word of words) {
          const trial = current ? `${current} ${word}` : word;
          if (font.widthOfTextAtSize(trial, size) > maxW) {
            if (current) lines.push(current);
            current = word;
          } else {
            current = trial;
          }
        }
        if (current) lines.push(current);
        return lines;
      };

      // Title page
      let { page, y } = addPage();

      // Book title
      const titleSize = 24;
      const titleLines = wrapText(book.title, timesBold, titleSize, maxWidth);
      y = pageHeight / 2 + (titleLines.length * titleSize * 1.3) / 2;
      for (const line of titleLines) {
        const w = timesBold.widthOfTextAtSize(line, titleSize);
        page.drawText(line, { x: (pageWidth - w) / 2, y, font: timesBold, size: titleSize, color: rgb(0, 0, 0) });
        y -= titleSize * 1.4;
      }

      if (book.logline) {
        const logSize = 12;
        const logLines = wrapText(book.logline, timesItalic, logSize, maxWidth - 60);
        y -= 20;
        for (const line of logLines) {
          const w = timesItalic.widthOfTextAtSize(line, logSize);
          page.drawText(line, { x: (pageWidth - w) / 2, y, font: timesItalic, size: logSize, color: rgb(0.3, 0.3, 0.3) });
          y -= logSize * 1.5;
        }
      }

      // Chapters
      for (const ch of generatedChapters) {
        // Chapter title on new page
        ({ page, y } = addPage());

        const chTitleSize = 16;
        const chLines = wrapText(ch.title, timesBold, chTitleSize, maxWidth);
        for (const line of chLines) {
          page.drawText(line, { x: marginX, y, font: timesBold, size: chTitleSize, color: rgb(0, 0, 0) });
          y -= chTitleSize * 1.4;
        }
        y -= 20;

        // Body text
        const paragraphs = (ch.generatedText ?? "").split(/\n\n+/).filter((p) => p.trim());
        for (const para of paragraphs) {
          const bodyLines = wrapText(para.trim(), timesFont, bodySize, maxWidth);
          for (const line of bodyLines) {
            if (y < marginY + lineHeight) {
              ({ page, y } = addPage());
            }
            page.drawText(line, { x: marginX, y, font: timesFont, size: bodySize, color: rgb(0, 0, 0) });
            y -= lineHeight;
          }
          y -= lineHeight * 0.5; // paragraph gap
        }
      }

      const pdfBytes = await pdfDoc.save();
      const filename = sanitizeFilename(book.title) + ".pdf";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      req.log.error({ err }, "PDF generation failed");
      res.status(500).json({ error: "PDF generation failed" });
    }
    return;
  }

  if (format === "epub") {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // mimetype (must be first, uncompressed)
      zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

      // META-INF/container.xml
      zip.folder("META-INF")!.file(
        "container.xml",
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
      );

      const oebps = zip.folder("OEBPS")!;

      // Build chapter items
      const chapterItems = generatedChapters.map((ch, idx) => {
        const fname = `chapter${String(idx + 1).padStart(3, "0")}.xhtml`;
        return { ch, fname, id: `ch${idx + 1}` };
      });

      // Write chapter files
      for (const { ch, fname } of chapterItems) {
        const content = htmlParagraphs(ch.generatedText ?? "");
        oebps.file(
          fname,
          `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="UTF-8"/><title>${escapeXml(ch.title)}</title>
<style>
  body { font-family: Georgia, serif; line-height: 1.8; margin: 2em 3em; }
  h1 { font-size: 1.4em; font-weight: bold; margin-bottom: 1.5em; }
  p { margin: 0 0 1em; text-indent: 1.5em; }
</style>
</head>
<body><h1>${escapeXml(ch.title)}</h1>${content}</body>
</html>`
        );
      }

      // NCX toc
      const navPoints = chapterItems
        .map(
          ({ ch, fname, id }, i) =>
            `<navPoint id="${id}" playOrder="${i + 1}">
  <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
  <content src="${fname}"/>
</navPoint>`
        )
        .join("\n");

      oebps.file(
        "toc.ncx",
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="book-${book.id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(book.title)}</text></docTitle>
  <navMap>${navPoints}</navMap>
</ncx>`
      );

      // NAV document (EPUB 3)
      const navLis = chapterItems
        .map(({ ch, fname }) => `<li><a href="${fname}">${escapeXml(ch.title)}</a></li>`)
        .join("\n");

      oebps.file(
        "nav.xhtml",
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="UTF-8"/><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc"><h1>Table of Contents</h1>
    <ol>${navLis}</ol>
  </nav>
</body>
</html>`
      );

      // content.opf
      const manifestItems = [
        `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
        `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
        ...chapterItems.map(
          ({ fname, id }) =>
            `<item id="${id}" href="${fname}" media-type="application/xhtml+xml"/>`
        ),
      ].join("\n    ");

      const spineItems = chapterItems
        .map(({ id }) => `<itemref idref="${id}"/>`)
        .join("\n    ");

      oebps.file(
        "content.opf",
        `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">book-${book.id}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>AI Ghostwriter</dc:creator>
    <dc:description>${escapeXml(book.logline || "")}</dc:description>
    <meta property="dcterms:modified">${new Date().toISOString().split(".")[0]}Z</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`
      );

      const epubBuffer = await zip.generateAsync({
        type: "nodebuffer",
        mimeType: "application/epub+zip",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
      });

      const filename = sanitizeFilename(book.title) + ".epub";
      res.setHeader("Content-Type", "application/epub+zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(epubBuffer);
    } catch (err) {
      req.log.error({ err }, "EPUB generation failed");
      res.status(500).json({ error: "EPUB generation failed" });
    }
    return;
  }
});

function buildMarkdown(
  book: { title: string; logline: string; genre: string },
  chapters: Array<{ title: string; generatedText: string | null; chapterNumber: number }>
): string {
  const parts: string[] = [];
  parts.push(`# ${book.title}\n`);
  if (book.logline) parts.push(`*${book.logline}*\n`);
  if (book.genre) parts.push(`**Genre:** ${book.genre}\n`);
  parts.push("\n---\n");
  for (const ch of chapters) {
    parts.push(`\n## ${ch.title}\n\n`);
    parts.push((ch.generatedText ?? "").trim());
    parts.push("\n\n---\n");
  }
  return parts.join("\n");
}

function buildHtml(
  book: { title: string; logline: string },
  chapters: Array<{ title: string; generatedText: string | null }>
): string {
  const chaptersHtml = chapters
    .map(
      (ch) =>
        `<div class="chapter"><h2>${escapeXml(ch.title)}</h2>${htmlParagraphs(
          ch.generatedText ?? ""
        )}</div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.8; color: #1a1a1a; max-width: 650px; margin: 0 auto; }
  h1 { font-size: 24pt; text-align: center; margin-bottom: 0.5em; }
  h2 { font-size: 14pt; margin-top: 2em; margin-bottom: 1em; font-style: italic; }
  p { margin: 0 0 1em 0; text-indent: 1.5em; }
  .logline { font-style: italic; text-align: center; color: #555; margin-bottom: 2em; }
  .chapter { page-break-before: always; }
  .chapter:first-child { page-break-before: auto; }
</style>
</head>
<body>
<h1>${escapeXml(book.title)}</h1>
${book.logline ? `<p class="logline">${escapeXml(book.logline)}</p>` : ""}
${chaptersHtml}
</body>
</html>`;
}

function htmlParagraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p>${escapeXml(p.trim())}</p>`)
    .join("\n");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_\- ]/gi, "_").replace(/\s+/g, "_").slice(0, 80);
}

export default router;
