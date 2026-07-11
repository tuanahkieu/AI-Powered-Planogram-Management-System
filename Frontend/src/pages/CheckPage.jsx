import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle, AlertCircle, RefreshCw, Cpu, Image as ImageIcon } from 'lucide-react';
import { API } from './shared.js';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function CheckPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [stores, setStores] = useState([]);
  const [planograms, setPlanograms] = useState([]);
  
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedPlanogram, setSelectedPlanogram] = useState('');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchStores();
    fetchPlanograms();
  }, []);
  
  const fetchStores = async () => {
    try {
      const res = await fetch(`${API}/api/stores`);
      const data = await res.json();
      if (data.success) setStores(data.stores);
    } catch (e) { console.warn(e); }
  };

  const fetchPlanograms = async () => {
    try {
      const res = await fetch(`${API}/api/planograms`);
      const data = await res.json();
      if (data.success && data.files.length > 0) {
        if (data.source === 'mongodb') {
          setPlanograms(data.data.map(item => ({
            value: item.name,
            text: item.display_name,
            store_id: item.store_id
          })));
        } else {
          setPlanograms(data.files.map(f => ({
            value: f,
            text: f.replace('planogram_', '').replace('.json', '').replace(/_/g, ' '),
            store_id: null
          })));
        }
      }
    } catch (e) { console.warn(e); }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f && f.type.startsWith('image/')) {
      setFile(f);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(f);
      setResult(null);
      setError('');
    }
  };

  const handleAnalyze = async () => {
    if (!file || !selectedPlanogram) {
      setError('Vui lòng chọn kệ và tải ảnh lên!');
      return;
    }
    
    setLoading(true);
    setResult(null);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('planogram', JSON.stringify({ shelves: [] }));
    
    if (selectedStore) formData.append('store_id', selectedStore);
    
    const selOption = planograms.find(p => p.value === selectedPlanogram);
    formData.append('planogram_file', selectedPlanogram);
    formData.append('planogram_display_name', selOption ? selOption.text : 'Unknown Shelf');

    try {
      const response = await fetch(`${API}/api/compliance`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlanograms = selectedStore 
    ? planograms.filter(p => p.store_id === selectedStore)
    : planograms;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Kiểm Tra Tuân Thủ Planogram</h1>
          <p className="text-muted-foreground mt-2">So sánh ảnh chụp thực tế với sơ đồ trưng bày chuẩn được giao</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="-- Chọn cửa hàng --" />
            </SelectTrigger>
            <SelectContent>
              {stores.map(s => <SelectItem key={s.store_id} value={s.store_id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedPlanogram} onValueChange={setSelectedPlanogram}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="-- Chọn kệ --" />
            </SelectTrigger>
            <SelectContent>
              {filteredPlanograms.map(p => <SelectItem key={p.value} value={p.value}>{p.text}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="text-primary" size={20} />
              Tải Ảnh Kệ Hàng
            </CardTitle>
            <CardDescription>Upload ảnh kệ hàng thực tế từ cửa hàng để AI đối chiếu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            
            <AnimatePresence mode="wait">
              {!preview ? (
                <motion.div 
                  key="upload" 
                  onClick={() => fileInputRef.current?.click()}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <div className="p-4 bg-primary/10 rounded-full mb-4">
                    <ImageIcon className="text-primary" size={32} />
                  </div>
                  <h4 className="font-semibold text-lg text-foreground">Tải ảnh lên</h4>
                  <p className="text-sm text-muted-foreground">Click hoặc kéo thả ảnh vào đây</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="preview" 
                  onClick={() => fileInputRef.current?.click()}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="relative rounded-xl overflow-hidden cursor-pointer group border border-border"
                >
                  <img src={preview} alt="Preview" className="w-full h-auto max-h-[400px] object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white font-medium bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">Nhấn để đổi ảnh khác</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <Button 
              className="w-full h-12 text-base font-medium shadow-sm transition-all" 
              onClick={handleAnalyze} 
              disabled={loading || !file}
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  AI đang xử lý...
                </>
              ) : (
                <>
                  <Cpu className="mr-2 h-5 w-5" />
                  Phân tích Hình Ảnh
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm bg-muted/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="text-green-500" size={20} />
              Kết Quả Phân Tích
            </CardTitle>
            <CardDescription>Đánh giá sự tuân thủ trưng bày của ảnh chụp.</CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {!result && !loading && (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                  <Cpu size={48} className="opacity-20 mb-4" />
                  <p className="font-medium text-lg">Chưa có dữ liệu phân tích</p>
                  <span className="text-sm opacity-70">Kết quả AI sẽ được hiển thị chi tiết tại đây</span>
                </motion.div>
              )}

              {loading && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                    <RefreshCw className="animate-spin text-primary relative z-10" size={48} />
                  </div>
                  <p className="mt-6 font-medium animate-pulse">Hệ thống AI đang quét hình ảnh...</p>
                </motion.div>
              )}

              {result && (
                <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div className={`p-4 rounded-xl border flex items-center gap-3 ${result.status === 'PASSED' ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
                    {result.status === 'PASSED' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                    <div>
                      <h4 className="font-bold text-lg">
                        {result.status === 'PASSED' ? 'Tuân thủ đạt chuẩn 100%' : 'Phát hiện lỗi vi phạm trưng bày'}
                      </h4>
                    </div>
                  </div>
                  
                  {result.issues && result.issues.length > 0 && (
                    <div className="bg-background rounded-xl p-4 border shadow-sm">
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                        <Badge variant="destructive" className="rounded-md px-1.5">{result.issues.length}</Badge> 
                        Lỗi phát hiện
                      </h4>
                      <ul className="space-y-2">
                        {result.issues.map((issue, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="text-destructive mt-0.5">•</span> 
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Ảnh nhận dạng (AI Bounding Boxes)</h4>
                    {result.annotated_image ? (
                      <div className="rounded-xl overflow-hidden border shadow-sm">
                        <img src={result.annotated_image} alt="AI Result" className="w-full h-auto" />
                      </div>
                    ) : (
                      <div className="p-4 bg-background border rounded-xl text-sm text-muted-foreground">Không có ảnh trả về.</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
