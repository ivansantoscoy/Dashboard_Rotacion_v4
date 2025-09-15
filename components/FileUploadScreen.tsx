import React, { useState, useMemo, DragEvent, ChangeEvent } from 'react';

interface FileUploadProps {
  onProcess: (activo: File, bajas: File, matriz: File) => void;
}

interface FileInputProps {
  id: string;
  label: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

const FileInput: React.FC<FileInputProps> = ({ id, label, description, file, onFileChange }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => e.preventDefault();
  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileChange(e.dataTransfer.files[0]);
    }
  };
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileChange(e.target.files[0]);
    }
    // Reset input value to allow re-uploading the same file name
    e.target.value = '';
  };
  
  const resetFile = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onFileChange(null);
  };

  const baseClasses = "flex flex-col items-center justify-center w-full h-48 border-2 rounded-lg cursor-pointer transition-colors duration-300 ease-in-out";
  const idleClasses = "border-gray-300 border-dashed bg-gray-50 hover:bg-gray-100";
  const draggingClasses = "border-indigo-500 bg-indigo-50";
  const successClasses = "border-green-400 bg-green-50";
  
  const stateClasses = file ? successClasses : isDragging ? draggingClasses : idleClasses;

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className={`${baseClasses} ${stateClasses}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-2">
          {file ? (
            <>
              <svg aria-hidden="true" className="w-10 h-10 mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <p className="mb-2 text-sm text-gray-700 font-semibold break-all">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
              <button onClick={resetFile} className="mt-2 text-xs text-red-500 hover:underline">Cambiar archivo</button>
            </>
          ) : (
            <>
              <svg aria-hidden="true" className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">{label}</span></p>
              <p className="text-xs text-gray-500">{description}</p>
            </>
          )}
        </div>
        <input id={id} type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
      </label>
    </div>
  );
};

const FileUploadScreen: React.FC<FileUploadProps> = ({ onProcess }) => {
  const [activoFile, setActivoFile] = useState<File | null>(null);
  const [bajasFile, setBajasFile] = useState<File | null>(null);
  const [matrizFile, setMatrizFile] = useState<File | null>(null);

  const canProcess = useMemo(() => !!(activoFile && bajasFile && matrizFile), [activoFile, bajasFile, matrizFile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canProcess) {
      onProcess(activoFile, bajasFile, matrizFile);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-lg">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900">Subir Archivos de Datos</h2>
        <p className="mt-2 text-md text-gray-500">
          Por favor, sube los tres archivos Excel requeridos para generar el dashboard de rotación.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FileInput
            id="activo-file"
            label="1. Archivo de Activos"
            description="Activo_[Cliente].xlsx"
            file={activoFile}
            onFileChange={setActivoFile}
          />
          <FileInput
            id="bajas-file"
            label="2. Archivo de Bajas"
            description="Bajas_[Cliente].xlsx"
            file={bajasFile}
            onFileChange={setBajasFile}
          />
          <FileInput
            id="matriz-file"
            label="3. Matriz de Rotación"
            description="MatrizRotacion_[...].xlsx"
            file={matrizFile}
            onFileChange={setMatrizFile}
          />
        </div>
        <div className="text-center">
          <button
            type="submit"
            disabled={!canProcess}
            className="w-full md:w-auto inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300"
            aria-disabled={!canProcess}
          >
            Generar Dashboard
          </button>
        </div>
      </form>
    </div>
  );
};

export default FileUploadScreen;
