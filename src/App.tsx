import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Pencil,
  Eraser,
  Type,
  Sparkles,
  Undo,
  Download,
  RotateCw,
  Palette,
} from "lucide-react";

export default function BreezeEditorGame() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("draw");
  const [color, setColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(5);
  const [image, setImage] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
  }, []);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    setHistory((prev) => [...prev.slice(-9), canvas.toDataURL()]);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setImage(Image);
          saveHistory();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");

    if (tool === "draw") {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (tool === "erase") {
      ctx.clearRect(x - brushSize / 2, y - brushSize / 2, brushSize, brushSize);
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistory();
    }
  };

  const applyFilter = (filterType) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (filterType === "grayscale") {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = data[i + 1] = data[i + 2] = avg;
      } else if (filterType === "invert") {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      } else if (filterType === "brighten") {
        data[i] = Math.min(255, data[i] + 30);
        data[i + 1] = Math.min(255, data[i + 1] + 30);
        data[i + 2] = Math.min(255, data[i + 2] + 30);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    saveHistory();
  };

  const rotate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(imageData, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(tempCanvas, -canvas.width / 2, -canvas.height / 2);
    ctx.restore();
    saveHistory();
  };

  const undo = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = newHistory[newHistory.length - 1];
    }
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = "my-edited-image.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  const addSticker = (emoji) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.font = "48px Arial";
    ctx.fillText(
      emoji,
      Math.random() * (canvas.width - 50),
      Math.random() * (canvas.height - 50)
    );
    saveHistory();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white text-center mb-8 drop-shadow-lg">
          🎨 Image Editor Game
        </h1>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 mb-6 pb-6 border-b">
            <label className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <Upload size={20} />
              Upload Image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={() => setTool("draw")}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
                tool === "draw"
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              <Pencil size={20} />
              Draw
            </button>

            <button
              onClick={() => setTool("erase")}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
                tool === "erase"
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              <Eraser size={20} />
              Erase
            </button>

            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-12 h-10 rounded-lg cursor-pointer border-2 border-gray-300"
              title="Pick Color"
            />

            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-32"
              title="Brush Size"
            />
            <span className="py-2 text-sm text-gray-600">
              Size: {brushSize}
            </span>
          </div>

          {/* Effects & Actions */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => applyFilter("grayscale")}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition"
            >
              Grayscale
            </button>

            <button
              onClick={() => applyFilter("invert")}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition"
            >
              Invert
            </button>

            <button
              onClick={() => applyFilter("brighten")}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition"
            >
              Brighten
            </button>

            <button
              onClick={rotate}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg flex items-center gap-2 transition"
            >
              <RotateCw size={20} />
              Rotate
            </button>

            <button
              onClick={undo}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-2 transition"
            >
              <Undo size={20} />
              Undo
            </button>

            <button
              onClick={downloadImage}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition"
            >
              <Download size={20} />
              Download
            </button>
          </div>

          {/* Stickers */}
          <div className="flex flex-wrap gap-2 mb-6 pb-6 border-b">
            <span className="text-sm text-gray-600 py-2">Add Stickers:</span>
            {["⭐", "❤️", "🎨", "🌈", "✨", "🦄", "🎮", "🔥", "💎", "🌟"].map(
              (emoji) => (
                <button
                  key={emoji}
                  onClick={() => addSticker(emoji)}
                  className="text-2xl hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              )
            )}
          </div>

          {/* Canvas */}
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className="border-4 border-gray-300 rounded-lg shadow-lg cursor-crosshair bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
