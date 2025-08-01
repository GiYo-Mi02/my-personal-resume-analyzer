export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    isLoading = true;
    try {
        // @ts-expect-error - pdfjs-dist/build/pdf.mjs is not a module
        loadPromise = import("pdfjs-dist/build/pdf.mjs").then(async (lib) => {
            // Try worker sources in order of preference
            const workerUrls = [
                // Local worker file (now updated to match version)
                "/pdf.worker.min.mjs",
                // CDN with the exact library version
                `https://unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`,
                // Fallback to a known working version
                "https://unpkg.com/pdfjs-dist@5.4.54/build/pdf.worker.min.mjs"
            ];
            
            // Set the worker source (prefer local first)
            lib.GlobalWorkerOptions.workerSrc = workerUrls[0];
            console.log('PDF.js loaded version:', lib.version, 'with worker:', lib.GlobalWorkerOptions.workerSrc);
            
            pdfjsLib = lib;
            isLoading = false;
            return lib;
        });

        return await loadPromise;
    } catch (error) {
        console.error('Failed to load PDF.js:', error);
        isLoading = false;
        loadPromise = null;
        throw new Error(`Failed to load PDF.js library: ${error}`);
    }
}

export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    try {
        console.log('Starting PDF conversion for file:', file.name, 'Type:', file.type, 'Size:', file.size);
        
        // Check browser compatibility
        if (typeof document === 'undefined') {
            return {
                imageUrl: "",
                file: null,
                error: "Document not available (server-side rendering)",
            };
        }

        if (!HTMLCanvasElement.prototype.getContext) {
            return {
                imageUrl: "",
                file: null,
                error: "Canvas not supported in this browser",
            };
        }

        // Validate file type
        if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
            return {
                imageUrl: "",
                file: null,
                error: "File is not a PDF",
            };
        }

        // Check file size (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
            return {
                imageUrl: "",
                file: null,
                error: "PDF file is too large (max 50MB)",
            };
        }

        // Check if file is empty
        if (file.size === 0) {
            return {
                imageUrl: "",
                file: null,
                error: "PDF file is empty",
            };
        }

        console.log('Loading PDF.js library...');
        const lib = await loadPdfJs();
        console.log('PDF.js library loaded successfully');

        console.log('Reading file as array buffer...');
        const arrayBuffer = await file.arrayBuffer();
        console.log('File read successfully, buffer size:', arrayBuffer.byteLength);
        
        console.log('Loading PDF document...');
        const loadingTask = lib.getDocument({ 
            data: arrayBuffer,
            // Add some options to handle potential issues
            useSystemFonts: true,
            disableFontFace: false,
            verbosity: 0 // Reduce verbosity to avoid console spam
        });
        
        const pdf = await loadingTask.promise;
        console.log('PDF document loaded, pages:', pdf.numPages);
        
        console.log('Getting first page...');
        const page = await pdf.getPage(1);
        console.log('First page loaded successfully');

        console.log('Creating viewport and canvas...');
        const viewport = page.getViewport({ scale: 4 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
            return {
                imageUrl: "",
                file: null,
                error: "Failed to get canvas 2D context",
            };
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        console.log('Rendering page to canvas...');
        await page.render({ canvasContext: context, viewport }).promise;
        console.log('Page rendered successfully');

        console.log('Converting canvas to blob...');
        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        console.log('Blob created successfully, size:', blob.size);
                        // Create a File from the blob with the same name as the pdf
                        const originalName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File([blob], `${originalName}.png`, {
                            type: "image/png",
                        });

                        console.log('Image file created:', imageFile.name);
                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } else {
                        console.error('Failed to create blob from canvas');
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create image blob",
                        });
                    }
                },
                "image/png",
                1.0
            ); // Set quality to maximum (1.0)
        });
    } catch (err) {
        console.error('PDF conversion error:', err);
        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF: ${err}`,
        };
    }
}
