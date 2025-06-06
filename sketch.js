// Crime de código

let originalImg;
let originalCanvas, fftCanvas;
let originalCtx, fftCtx;
let imgData;
let fftMagnitudeData;
let fftPhaseData;
let originalFFTMagnitude;
let originalFFTPhase;
let canvasSize = 512;
let brushSize = 20;
let drawMode = 'erase';
let isDrawing = false;
let circleStartX = 0;
let circleStartY = 0;
let tempCircleRadius = 0;
let drawingCircle = false;
let lastDrawX = -1;
let lastDrawY = -1;
let maxFFTValue = 0;

document.addEventListener('DOMContentLoaded', function() {
    initializeCanvases();
    setupControls();
    loadDefaultImage();
});

function initializeCanvases() {
    originalCanvas = document.getElementById('originalCanvas');
    fftCanvas = document.getElementById('fftCanvas');
    
    if (!originalCanvas || !fftCanvas) {
        return;
    }
    
    originalCtx = originalCanvas.getContext('2d');
    fftCtx = fftCanvas.getContext('2d');
    
    drawInitialState(originalCtx, 'Imagem Original');
    drawInitialState(fftCtx, 'Domínio da Frequência');
    
    setupCanvasEvents();
}

function drawInitialState(ctx, text) {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = '#666';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const lines = text.split('\\n');
    const lineHeight = 20;
    const startY = canvasSize/2 - (lines.length - 1) * lineHeight/2;
    
    lines.forEach((line, index) => {
        ctx.fillText(line, canvasSize/2, startY + index * lineHeight);
    });
}

function setupControls() {
    const fileInput = document.getElementById('imageUpload');
    if (fileInput) {
        fileInput.addEventListener('change', handleImageUpload);
    }
    
    const brushSizeSlider = document.getElementById('brushSize');
    const brushSizeValue = document.getElementById('brushSizeValue');
    
    if (brushSizeSlider && brushSizeValue) {
        brushSizeSlider.addEventListener('input', function(e) {
            brushSize = parseInt(e.target.value);
            brushSizeValue.textContent = brushSize;
        });
    }
    
    const drawModeSelect = document.getElementById('drawMode');
    if (drawModeSelect) {
        if (!drawModeSelect.querySelector('option[value="circle"]')) {
            const circleOption = document.createElement('option');
            circleOption.value = 'circle';
            circleOption.textContent = '⭕ Círculo';
            drawModeSelect.appendChild(circleOption);
        }

        drawModeSelect.addEventListener('change', function(e) {
            drawMode = e.target.value;
        });
    }
    
    const fileWrapper = document.querySelector('.file-input-wrapper');
    if (fileWrapper && fileInput) {
        fileWrapper.addEventListener('click', function(e) {
            if (e.target !== fileInput) {
                fileInput.click();
            }
        });
    }
}

function setupCanvasEvents() {
    if (!fftCanvas) return;
    
    fftCanvas.addEventListener('mousedown', function(e) {
        if (fftMagnitudeData) {
            const rect = fftCanvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) * canvasSize / rect.width);
            const y = Math.floor((e.clientY - rect.top) * canvasSize / rect.height);
            
            lastDrawX = -1;
            lastDrawY = -1;
            
            if (drawMode === 'circle') {
                drawingCircle = true;
                circleStartX = x;
                circleStartY = y;
                tempCircleRadius = 0;
            } else {
                isDrawing = true;
                drawOnFFT(e, false);
            }
        }
    });
    
    fftCanvas.addEventListener('mousemove', function(e) {
        if (fftMagnitudeData) {
            const rect = fftCanvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) * canvasSize / rect.width);
            const y = Math.floor((e.clientY - rect.top) * canvasSize / rect.height);
            
            if (drawingCircle) {
                const dx = x - circleStartX;
                const dy = y - circleStartY;
                tempCircleRadius = Math.sqrt(dx*dx + dy*dy);
                
                displayFFT(true);
            } else if (isDrawing) {
                drawOnFFT(e, false);
            }
        }
    });
    
    fftCanvas.addEventListener('mouseup', function(e) {
        if (drawingCircle && fftMagnitudeData) {
            const rect = fftCanvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) * canvasSize / rect.width);
            const y = Math.floor((e.clientY - rect.top) * canvasSize / rect.height);
            
            const dx = x - circleStartX;
            const dy = y - circleStartY;
            const radius = Math.sqrt(dx*dx + dy*dy);
            
            drawCircleOnFFT(circleStartX, circleStartY, radius);
            
            drawingCircle = false;
            
            displayFFT();
            reconstructImage();
        } else if (isDrawing) {
            displayFFT();
            reconstructImage();
        }
        
        isDrawing = false;
        drawingCircle = false;
        
        lastDrawX = -1;
        lastDrawY = -1;
    });
    
    fftCanvas.addEventListener('mouseleave', function() {
        if (isDrawing) {
            displayFFT();
            reconstructImage();
        }
        
        isDrawing = false;
        
        lastDrawX = -1;
        lastDrawY = -1;
    });
    
    fftCanvas.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
}

function loadDefaultImage() {
    const img = new Image();
    
    img.onload = function() {
        originalImg = img;
        processImage();
    };
    
    img.onerror = function() {
        alert('Não foi possível carregar a imagem padrão.');
    };
    
    img.src = 'Lenna.png';
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem válido.');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            originalImg = img;
            processImage();
        };
        
        img.onerror = function() {
            alert('Erro ao carregar a imagem. Tente outro arquivo.');
        };
        
        img.src = e.target.result;
    };
    
    reader.onerror = function() {
        alert('Erro ao ler o arquivo. Tente novamente.');
    };
    
    reader.readAsDataURL(file);
}

function processImage() {
    if (!originalCtx || !originalImg) {
        return;
    }
    
    originalCtx.clearRect(0, 0, canvasSize, canvasSize);
    originalCtx.fillStyle = '#fff';
    originalCtx.fillRect(0, 0, canvasSize, canvasSize);
    
    let aspectRatio = originalImg.width / originalImg.height;
    let drawWidth, drawHeight;
    
    if (aspectRatio > 1) {
        drawWidth = canvasSize;
        drawHeight = canvasSize / aspectRatio;
    } else {
        drawWidth = canvasSize * aspectRatio;
        drawHeight = canvasSize;
    }
    
    let x = (canvasSize - drawWidth) / 2;
    let y = (canvasSize - drawHeight) / 2;
    
    originalCtx.drawImage(originalImg, x, y, drawWidth, drawHeight);
    
    imgData = originalCtx.getImageData(0, 0, canvasSize, canvasSize);
    
    // Convert to black and white
    for (let i = 0; i < imgData.data.length; i += 4) {
        const r = imgData.data[i];
        const g = imgData.data[i + 1];
        const b = imgData.data[i + 2];
        
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        imgData.data[i] = gray;
        imgData.data[i + 1] = gray;
        imgData.data[i + 2] = gray;
    }
    
    originalCtx.putImageData(imgData, 0, 0);
    
    calculateAndDisplayFFT();
    
    lastDrawX = -1;
    lastDrawY = -1;
}

function calculateAndDisplayFFT() {
    let grayData = [];
    
    for (let i = 0; i < imgData.data.length; i += 4) {
        let r = imgData.data[i];
        let g = imgData.data[i + 1];
        let b = imgData.data[i + 2];
        let gray = (r + g + b) / 3;
        grayData.push(gray);
    }
    
    const fftResult = compute2DFFT(grayData, canvasSize, canvasSize);
    
    fftMagnitudeData = fftResult.magnitude;
    fftPhaseData = fftResult.phase;
    
    originalFFTMagnitude = [...fftMagnitudeData];
    originalFFTPhase = [...fftPhaseData];
    
    maxFFTValue = 0;
    for (let i = 0; i < fftMagnitudeData.length; i++) {
        if (fftMagnitudeData[i] > maxFFTValue) {
            maxFFTValue = fftMagnitudeData[i];
        }
    }
    
    displayFFT();
}

function fft1d(signal) {
    const n = signal.length;
    
    if (n === 1) {
        return [{ real: signal[0].real, imag: signal[0].imag }];
    }
    
    if (n & (n - 1)) {
        return [];
    }
    
    const result = new Array(n);
    for (let i = 0; i < n; i++) {
        result[i] = { real: signal[i].real, imag: signal[i].imag };
    }
    
    for (let i = 0, j = 0; i < n; i++) {
        if (i < j) {
            const temp = { real: result[i].real, imag: result[i].imag };
            result[i] = { real: result[j].real, imag: result[j].imag };
            result[j] = { real: temp.real, imag: temp.imag };
        }
        
        let k = n >> 1;
        while (k > 0 && j >= k) {
            j -= k;
            k >>= 1;
        }
        j += k;
    }
    
    for (let s = 1; s < Math.log2(n) + 1; s++) {
        const m = Math.pow(2, s);
        const wm = { real: Math.cos(-2 * Math.PI / m), imag: Math.sin(-2 * Math.PI / m) };
        
        for (let k = 0; k < n; k += m) {
            let w = { real: 1, imag: 0 };
            
            for (let j = 0; j < m/2; j++) {
                const t = {
                    real: w.real * result[k + j + m/2].real - w.imag * result[k + j + m/2].imag,
                    imag: w.real * result[k + j + m/2].imag + w.imag * result[k + j + m/2].real
                };
                
                const u = { real: result[k + j].real, imag: result[k + j].imag };
                
                result[k + j] = {
                    real: u.real + t.real,
                    imag: u.imag + t.imag
                };
                
                result[k + j + m/2] = {
                    real: u.real - t.real,
                    imag: u.imag - t.imag
                };
                
                const nextW = {
                    real: w.real * wm.real - w.imag * wm.imag,
                    imag: w.real * wm.imag + w.imag * wm.real
                };
                w = nextW;
            }
        }
    }
    
    return result;
}

function ifft1d(spectrum) {
    const n = spectrum.length;
    
    const conjugatedSpectrum = spectrum.map(x => ({ real: x.real, imag: -x.imag }));
    
    const result = fft1d(conjugatedSpectrum);
    
    return result.map(x => ({ 
        real: x.real / n, 
        imag: -x.imag / n 
    }));
}

function isPowerOf2(n) {
    return n && (n & (n - 1)) === 0;
}

function padToPowerOf2(array) {
    if (isPowerOf2(array.length)) {
        return array;
    }
    
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(array.length)));
    const padded = [...array];
    
    for (let i = array.length; i < nextPow2; i++) {
        padded.push({ real: 0, imag: 0 });
    }
    
    return padded;
}

function compute2DFFT(data, width, height) {
    if (!isPowerOf2(width) || !isPowerOf2(height)) {
    }
    
    let realData = [];
    for (let i = 0; i < data.length; i++) {
        realData.push({ real: data[i], imag: 0 });
    }
    
    let rowFFT = [];
    for (let y = 0; y < height; y++) {
        let row = [];
        for (let x = 0; x < width; x++) {
            row.push(realData[y * width + x]);
        }
        
        row = padToPowerOf2(row);
        
        rowFFT.push(fft1d(row));
    }
    
    let result = Array(height).fill().map(() => Array(width).fill(null));
    
    for (let x = 0; x < width; x++) {
        let col = [];
        for (let y = 0; y < height; y++) {
            col.push(rowFFT[y][x]);
        }
        
        col = padToPowerOf2(col);
        
        let colFFT = fft1d(col);
        
        for (let y = 0; y < height; y++) {
            result[y][x] = colFFT[y];
        }
    }
    
    let magnitude = [];
    let phase = [];
    
    const totalPixels = width * height;
    
    for (let i = 0; i < totalPixels; i++) {
        const y = Math.floor(i / width);
        const x = i % width;
        
        if (result[y] && result[y][x]) {
            let real = result[y][x].real;
            let imag = result[y][x].imag;
            
            let mag = Math.sqrt(real * real + imag * imag);
            let ph = Math.atan2(imag, real);
            
            magnitude.push(mag);
            phase.push(ph);
        } else {
            magnitude.push(0);
            phase.push(0);
        }
    }
    
    return { magnitude, phase };
}

function displayFFT(showPreview = false) {
    if (!fftCtx || !fftMagnitudeData) {
        return;
    }
    
    const fftMagnitudeDisplay = [...fftMagnitudeData];
    
    const maxMag = maxFFTValue;
    
    const imageData = fftCtx.createImageData(canvasSize, canvasSize);
    
    for (let i = 0; i < fftMagnitudeDisplay.length; i++) {
        let normalizedMag = Math.log(1 + fftMagnitudeDisplay[i]) / Math.log(1 + maxMag);
        let value = Math.max(0, Math.min(255, Math.round(normalizedMag * 255)));
        
        let idx = i * 4;
        
        imageData.data[idx] = value;     // R
        imageData.data[idx + 1] = value; // G
        imageData.data[idx + 2] = value; // B
        imageData.data[idx + 3] = 255;   // A
    }
    
    const shiftedImageData = fftShift(imageData, canvasSize, canvasSize);
    
    fftCtx.putImageData(shiftedImageData, 0, 0);
    
    if (showPreview && drawingCircle) {
        fftCtx.beginPath();
        fftCtx.arc(circleStartX, circleStartY, tempCircleRadius, 0, Math.PI * 2);
        fftCtx.strokeStyle = 'red';
        fftCtx.lineWidth = 2;
        fftCtx.stroke();
    }
}

function fftShift(imageData, width, height) {
    const shifted = fftCtx.createImageData(width, height);
    const halfW = Math.floor(width / 2);
    const halfH = Math.floor(height / 2);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let srcX = (x + halfW) % width;
            let srcY = (y + halfH) % height;
            
            let srcIdx = (srcY * width + srcX) * 4;
            let dstIdx = (y * width + x) * 4;
            
            shifted.data[dstIdx] = imageData.data[srcIdx];
            shifted.data[dstIdx + 1] = imageData.data[srcIdx + 1];
            shifted.data[dstIdx + 2] = imageData.data[srcIdx + 2];
            shifted.data[dstIdx + 3] = imageData.data[srcIdx + 3];
        }
    }
    
    return shifted;
}

function reconstructImage() {
    if (!originalCtx || !fftMagnitudeData || !fftPhaseData) {
        return;
    }
    
    let complexData = [];
    for (let i = 0; i < fftMagnitudeData.length; i++) {
        let mag = fftMagnitudeData[i];
        let phase = fftPhaseData[i];
        
        let real = mag * Math.cos(phase);
        let imag = mag * Math.sin(phase);
        
        complexData.push({ real, imag });
    }
    
    let reconstructed = compute2DIFFT(complexData, canvasSize, canvasSize);
    
    let maxVal = -Infinity;
    let minVal = Infinity;
    
    for (let i = 0; i < reconstructed.length; i++) {
        if (reconstructed[i] > maxVal) maxVal = reconstructed[i];
        if (reconstructed[i] < minVal) minVal = reconstructed[i];
    }
    
    const imageData = originalCtx.createImageData(canvasSize, canvasSize);
    
    for (let i = 0; i < reconstructed.length; i++) {
        let normalized = (reconstructed[i] - minVal) / (maxVal - minVal);
        let value = Math.max(0, Math.min(255, Math.round(normalized * 255)));
        
        let idx = i * 4;
        
        imageData.data[idx] = value;     // R
        imageData.data[idx + 1] = value; // G
        imageData.data[idx + 2] = value; // B
        imageData.data[idx + 3] = 255;   // A
    }
    
    originalCtx.putImageData(imageData, 0, 0);
}

function compute2DIFFT(complexData, width, height) {
    let matrix = [];
    for (let y = 0; y < height; y++) {
        matrix[y] = [];
        for (let x = 0; x < width; x++) {
            matrix[y][x] = complexData[y * width + x];
        }
    }
    
    let rowIFFT = [];
    for (let y = 0; y < height; y++) {
        rowIFFT.push(ifft1d(matrix[y]));
    }
    
    let colIFFT = Array(height).fill().map(() => Array(width).fill(0));
    
    for (let x = 0; x < width; x++) {
        let col = [];
        for (let y = 0; y < height; y++) {
            col.push(rowIFFT[y][x]);
        }
        
        let colResult = ifft1d(col);
        
        for (let y = 0; y < height; y++) {
            colIFFT[y][x] = colResult[y].real;
        }
    }
    
    let flatResult = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            flatResult.push(colIFFT[y][x]);
        }
    }
    
    return flatResult;
}

function drawOnFFT(event, updateImage = true) {
    if (!fftMagnitudeData) return;
    
    const rect = fftCanvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * canvasSize / rect.width);
    const y = Math.floor((event.clientY - rect.top) * canvasSize / rect.height);
    
    if (x < 0 || x >= canvasSize || y < 0 || y >= canvasSize) return;
    
    if (lastDrawX >= 0 && lastDrawY >= 0 && (lastDrawX !== x || lastDrawY !== y)) {
        const points = getLinePoints(lastDrawX, lastDrawY, x, y);
        
        for (const point of points) {
            applyBrushAt(point.x, point.y);
        }
    } else {
        applyBrushAt(x, y);
    }
    
    lastDrawX = x;
    lastDrawY = y;
    
    if (updateImage) {
        displayFFT();
        reconstructImage();
    } else {
        displayFFT();
    }
}

function getLinePoints(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;
    
    while (true) {
        points.push({x: x0, y: y0});
        
        if (x0 === x1 && y0 === y1) break;
        
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y0 += sy;
        }
    }
    
    return points;
}

function applyBrushAt(x, y) {
    const fftDataCopy = [...fftMagnitudeData];
    
    const halfW = Math.floor(canvasSize / 2);
    const halfH = Math.floor(canvasSize / 2);
    const shiftedX = (x - halfW + canvasSize) % canvasSize;
    const shiftedY = (y - halfH + canvasSize) % canvasSize;
    
    for (let dy = -brushSize; dy <= brushSize; dy++) {
        for (let dx = -brushSize; dx <= brushSize; dx++) {
            let px = shiftedX + dx;
            let py = shiftedY + dy;
            
            px = (px + canvasSize) % canvasSize;
            py = (py + canvasSize) % canvasSize;
            
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= brushSize) {
                let i = py * canvasSize + px;
                if (i < fftMagnitudeData.length) {
                    let strength = Math.max(0, 1 - distance / brushSize);
                    
                    switch(drawMode) {
                        case 'erase':
                            fftMagnitudeData[i] *= (1 - strength * 0.8);
                            break;
                        case 'smooth':
                            let avg = 0;
                            let count = 0;
                            for (let sy = -1; sy <= 1; sy++) {
                                for (let sx = -1; sx <= 1; sx++) {
                                    let nx = (px + sx + canvasSize) % canvasSize;
                                    let ny = (py + sy + canvasSize) % canvasSize;
                                    let ni = ny * canvasSize + nx;
                                    if (ni < fftMagnitudeData.length) {
                                        avg += fftDataCopy[ni]; // Usar a cópia para não contaminar o cálculo
                                        count++;
                                    }
                                }
                            }
                            if (count > 0) {
                                let targetValue = avg / count;
                                fftMagnitudeData[i] = fftDataCopy[i] * (1 - strength * 0.3) + targetValue * (strength * 0.3);
                            }
                            break;
                    }
                }
            }
        }
    }
}

function resetFFT() {
    if (!originalImg) {
        return;
    }
    
    if (originalFFTMagnitude && originalFFTPhase) {
        fftMagnitudeData = [...originalFFTMagnitude];
        fftPhaseData = [...originalFFTPhase];
        
        maxFFTValue = 0;
        for (let i = 0; i < fftMagnitudeData.length; i++) {
            if (fftMagnitudeData[i] > maxFFTValue) {
                maxFFTValue = fftMagnitudeData[i];
            }
        }
        
        displayFFT();
        reconstructImage();
    } else {
        if (originalImg && originalCtx) {
            processImage();
        }
    }
}

function drawCircleOnFFT(centerX, centerY, radius) {
    if (!fftMagnitudeData) return;
    
    const halfW = Math.floor(canvasSize / 2);
    const halfH = Math.floor(canvasSize / 2);
    
    const startX = Math.max(0, Math.floor(centerX - radius - 1));
    const startY = Math.max(0, Math.floor(centerY - radius - 1));
    const endX = Math.min(canvasSize - 1, Math.ceil(centerX + radius + 1));
    const endY = Math.min(canvasSize - 1, Math.ceil(centerY + radius + 1));
    
    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance <= radius) {
                const shiftedX = (x - halfW + canvasSize) % canvasSize;
                const shiftedY = (y - halfH + canvasSize) % canvasSize;
                const i = shiftedY * canvasSize + shiftedX;
                
                if (i >= 0 && i < fftMagnitudeData.length) {
                    fftMagnitudeData[i] = 0;
                }
            }
        }
    }
}