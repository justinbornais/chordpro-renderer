import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportElementToPdf(element: HTMLElement, fileName: string) {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#f7f3ec',
    useCORS: true,
  });

  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2;
  const ratio = printableWidth / canvas.width;
  const sliceHeight = Math.floor(printableHeight / ratio);
  let offsetY = 0;
  let pageIndex = 0;

  while (offsetY < canvas.height) {
    const currentSliceHeight = Math.min(sliceHeight, canvas.height - offsetY);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = currentSliceHeight;

    const context = pageCanvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to prepare PDF page canvas.');
    }

    context.fillStyle = '#f7f3ec';
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      currentSliceHeight,
      0,
      0,
      canvas.width,
      currentSliceHeight,
    );

    const imageData = pageCanvas.toDataURL('image/png');
    const renderedHeight = currentSliceHeight * ratio;

    if (pageIndex > 0) {
      pdf.addPage();
    }

    pdf.addImage(imageData, 'PNG', margin, margin, printableWidth, renderedHeight);
    offsetY += currentSliceHeight;
    pageIndex += 1;
  }

  pdf.save(`${fileName}.pdf`);
}