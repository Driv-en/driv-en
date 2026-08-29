/* ==========================================================================
   DRIV‑EN TEMPLATE HELPERS — Shared functions for Excel template generation
   ==========================================================================
   This file provides a helper function that generates an XLSX file with
   FROZEN HEADER ROWS. SheetJS 0.18.5 community edition does NOT support
   freeze panes (the !freeze property is silently ignored), so we use JSZip
   to post-process the generated XLSX file and add the freeze pane XML manually.

   HOW TO USE:
   1. Include JSZip and this file on your page:
      <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
      <script src="/components/template-helpers.js"></script>
   2. Create your worksheet with SheetJS as normal (headers in Row 1)
   3. Call the helper function instead of XLSX.writeFile:
      await downloadXlsxWithFrozenHeader(ws, sheetName, fileName);

   WHAT IT DOES:
   1. Creates a workbook with SheetJS
   2. Writes it to an array buffer (instead of directly to a file)
   3. Loads the array buffer with JSZip (XLSX files are ZIP archives)
   4. Opens the worksheet XML file inside the ZIP
   5. Inserts a <pane> element into the <sheetView> to freeze Row 1
   6. Saves the modified ZIP as a new XLSX file and downloads it

   The freeze pane XML looks like:
   <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
   This freezes Row 1 so the column headers stay visible when scrolling down.
   ========================================================================== */

/*
 * downloadXlsxWithFrozenHeader
 * 
 * WHAT IT DOES: Generates an XLSX file with Row 1 (headers) frozen.
 * 
 * PARAMETERS:
 *   ws        — SheetJS worksheet object (created with XLSX.utils.aoa_to_sheet)
 *   sheetName — The name of the Excel sheet (e.g., "Employees")
 *   fileName  — The download file name (e.g., "Employee-Mass-Upload-v1.0.xlsx")
 * 
 * RETURNS: Nothing (triggers a file download in the browser)
 * 
 * NOTE: This function is async because it uses JSZip to modify the XLSX file.
 *       Call it with: await downloadXlsxWithFrozenHeader(ws, "Sheet", "file.xlsx");
 *       Or use .then(): downloadXlsxWithFrozenHeader(ws, "Sheet", "file.xlsx").then(function() { ... });
 */
async function downloadXlsxWithFrozenHeader(ws, sheetName, fileName) {
    // Step 1: Create a workbook with SheetJS
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Step 2: Write the workbook to an array buffer (not directly to file)
    // This gives us the raw XLSX file data as an ArrayBuffer
    var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    // Step 3: Load the array buffer with JSZip
    // XLSX files are actually ZIP archives containing XML files
    var zip = await JSZip.loadAsync(wbout);

    // Step 4: Get the worksheet XML from inside the ZIP
    // The first sheet is always at xl/worksheets/sheet1.xml
    var sheetFile = 'xl/worksheets/sheet1.xml';
    var sheetXml = await zip.file(sheetFile).async('string');

    // Step 5: Insert the freeze pane XML into the <sheetView> element
    // The <pane> element freezes Row 1 (ySplit="1") so the header row
    // stays visible when the user scrolls down through their data.
    // topLeftCell="A2" means the first scrollable cell is A2 (Row 2).
    // activePane="bottomLeft" means the bottom-left pane is active.
    // state="frozen" means the pane is frozen (not just split).
    var freezePaneXml = '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>';

    // Insert the <pane> element as the first child of <sheetView>
    // The regex matches <sheetView ...> (with any attributes) and inserts
    // the freeze pane XML right after the opening tag
    sheetXml = sheetXml.replace(
        /<sheetView([^>]*)>/,
        '<sheetView$1>' + freezePaneXml
    );

    // Step 6: Update the modified XML back into the ZIP
    zip.file(sheetFile, sheetXml);

    // Step 7: Generate the new ZIP/XLSX file as an array buffer
    var newWbout = await zip.generateAsync({ type: 'arraybuffer' });

    // Step 8: Create a Blob from the array buffer and trigger a download
    var blob = new Blob([newWbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
