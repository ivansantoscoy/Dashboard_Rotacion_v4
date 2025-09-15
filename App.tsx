import React, { useState, useCallback } from 'react';
import { DashboardData, CorrectionsMap } from './types';
import { processFiles } from './services/analytics';
import Dashboard from './components/Dashboard';
import FileUploadScreen from './components/FileUploadScreen';

const App: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileProcessing = useCallback(async (
    activoFile: File,
    bajasFile: File,
    matrizFile: File
  ) => {
    setIsLoading(true);
    setError(null);
    setDashboardData(null);

    try {
      const storedCorrections = localStorage.getItem('gemini_corrections');
      const corrections: CorrectionsMap = storedCorrections ? JSON.parse(storedCorrections) : {};
      const data = await processFiles(activoFile, bajasFile, matrizFile, corrections);
      setDashboardData(data);
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        setError(`An error occurred during processing: ${err.message}. Please check file formats and column names.`);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = () => {
    setDashboardData(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Dashboard de Análisis de Rotación
            </h1>
            {dashboardData && (
              <button
                onClick={handleReset}
                className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300"
              >
                Analizar Nuevos Archivos
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-64">
            <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-lg text-gray-600">Procesando datos... Esto puede tardar unos segundos.</p>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !dashboardData && <FileUploadScreen onProcess={handleFileProcessing} />}
        
        {dashboardData && <Dashboard data={dashboardData} />}
      </main>
    </div>
  );
};

export default App;
