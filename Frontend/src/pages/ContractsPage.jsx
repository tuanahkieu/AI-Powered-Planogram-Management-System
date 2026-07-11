import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Trash2, CheckCircle, Store, Tag, Layers, Calendar } from 'lucide-react';
import { API } from './shared.js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const BRAND_COLORS = [
  'linear-gradient(135deg,#6366f1,#4f46e5)',
  'linear-gradient(135deg,#ef4444,#dc2626)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  'linear-gradient(135deg,#8b5cf6,#7c3aed)',
  'linear-gradient(135deg,#ec4899,#db2777)',
];

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Wizard state
  const [step, setStep] = useState(1);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [planograms, setPlanograms] = useState([]);
  
  const [wizardData, setWizardData] = useState({
    storeId: null, storeName: null,
    brandName: null, brandColor: null,
    shelfId: null, shelfName: null,
    rows: [],
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365*86400000).toISOString().split('T')[0],
    status: 'active'
  });
  
  const [selectedPlanogramDetail, setSelectedPlanogramDetail] = useState(null);

  useEffect(() => {
    fetchContracts();
    fetchStores();
    fetchProducts();
  }, []);

  const fetchContracts = async () => {
    try {
      const res = await fetch(`${API}/api/contracts`);
      const data = await res.json();
      if (data.success) setContracts(data.contracts);
    } catch (e) { console.warn(e); }
  };

  const fetchStores = async () => {
    try {
      const res = await fetch(`${API}/api/stores`);
      const data = await res.json();
      if (data.success) setStores(data.stores);
    } catch (e) { console.warn(e); }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API}/api/products`);
      const data = await res.json();
      if (data.success) setProducts(data.products);
    } catch (e) { console.warn(e); }
  };

  const fetchPlanograms = async (storeId) => {
    try {
      const res = await fetch(`${API}/api/planograms?store_id=${storeId}`);
      const data = await res.json();
      if (data.success) setPlanograms(data.data || []);
    } catch (e) { console.warn(e); }
  };

  const deleteContract = async (id) => {
    if (!window.confirm('Xóa hợp đồng này?')) return;
    try {
      const res = await fetch(`${API}/api/contracts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchContracts();
    } catch (e) { console.warn(e); }
  };

  const openWizard = () => {
    setStep(1);
    setWizardData({
      storeId: null, storeName: null,
      brandName: null, brandColor: null,
      shelfId: null, shelfName: null,
      rows: [],
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365*86400000).toISOString().split('T')[0],
      status: 'active'
    });
    setIsModalOpen(true);
  };

  const handleNextStep = async (next) => {
    if (next === 3) await fetchPlanograms(wizardData.storeId);
    if (next === 4) {
      const res = await fetch(`${API}/api/planograms/${wizardData.shelfId}`);
      const data = await res.json();
      if (data.success) setSelectedPlanogramDetail(data.planogram);
    }
    setStep(next);
  };

  const submitContract = async () => {
    if (wizardData.rows.length === 0) {
      alert('Vui lòng chọn ít nhất 1 tầng');
      return;
    }
    try {
      const payload = {
        ...wizardData,
        brand_name: wizardData.brandName,
        brand_color: wizardData.brandColor,
        brand_code: wizardData.brandName.toLowerCase().replace(/\s+/g, '_'),
        store_id: wizardData.storeId,
        store_name: wizardData.storeName,
        shelf_id: wizardData.shelfId,
        shelf_name: wizardData.shelfName,
        start_date: wizardData.startDate,
        end_date: wizardData.endDate,
      };
      
      const res = await fetch(`${API}/api/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchContracts();
      } else {
        alert(data.error || 'Lỗi');
      }
    } catch (e) { console.warn(e); }
  };

  const toggleRow = (index) => {
    setWizardData(prev => ({
      ...prev,
      rows: prev.rows.includes(index) ? prev.rows.filter(r => r !== index) : [...prev.rows, index]
    }));
  };

  const brands = [...new Map(products.map(p => [p.name, p])).values()];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Hợp Đồng Nhãn Hàng</h1>
          <p className="text-muted-foreground mt-2">Quản lý thỏa thuận trưng bày với các nhà cung cấp</p>
        </div>
        <div>
          <Button onClick={openWizard} className="gap-2">
            <Plus size={20} /> Thêm hợp đồng
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {contracts.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            Chưa có hợp đồng nào được tạo.
          </div>
        )}
        <AnimatePresence>
          {contracts.map((c, i) => (
            <motion.div 
              key={c._id} 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="relative overflow-hidden group hover:shadow-md transition-all border-border">
                <CardContent className="p-6">
                  <div className="flex gap-4 items-center mb-6">
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-sm shrink-0"
                      style={{ background: c.brand_color || BRAND_COLORS[i%BRAND_COLORS.length] }}
                    >
                      {(c.brand_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg leading-tight text-foreground">{c.brand_name}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{c.store_name}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">{c.shelf_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm font-medium text-muted-foreground">Tầng: {c.rows?.map(r=>r+1).join(', ')}</span>
                    <Badge variant={c.status === 'active' ? "default" : "destructive"} className={c.status === 'active' ? "bg-green-500 hover:bg-green-600" : ""}>
                      {c.status === 'active' ? 'Hiệu lực' : 'Hết hạn'}
                    </Badge>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => deleteContract(c._id)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>Tạo Hợp Đồng Mới</DialogTitle>
          </DialogHeader>

          <div className="flex justify-center px-6 py-4 bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((s, i) => (
                <React.Fragment key={s}>
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${step >= s ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted text-muted-foreground'}`}>
                      {step > s ? <CheckCircle className="h-4 w-4" /> : s}
                    </div>
                  </div>
                  {i < 3 && <div className={`h-1 w-8 transition-colors ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="flex items-center gap-2 text-lg font-semibold mb-4"><Store className="h-5 w-5 text-primary" /> Chọn cửa hàng</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {stores.map(s => (
                      <div 
                        key={s.store_id} 
                        onClick={() => setWizardData({...wizardData, storeId: s.store_id, storeName: s.name})}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${wizardData.storeId === s.store_id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                      >
                        <div className="font-medium text-foreground">{s.name}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="flex items-center gap-2 text-lg font-semibold mb-4"><Tag className="h-5 w-5 text-primary" /> Chọn nhãn hàng</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {brands.map((b, i) => {
                      const color = b.color || BRAND_COLORS[i%BRAND_COLORS.length];
                      return (
                        <div 
                          key={b.name} 
                          onClick={() => setWizardData({...wizardData, brandName: b.name, brandColor: color})}
                          className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${wizardData.brandName === b.name ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                        >
                          <div className="w-10 h-10 rounded-lg text-white flex items-center justify-center font-bold" style={{ background: color }}>
                            {b.name[0].toUpperCase()}
                          </div>
                          <span className="font-medium">{b.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="flex items-center gap-2 text-lg font-semibold mb-4"><Layers className="h-5 w-5 text-primary" /> Chọn kệ hàng</h3>
                  {planograms.length === 0 ? <p className="text-muted-foreground">Cửa hàng này chưa có kệ nào.</p> : (
                    <div className="grid gap-3">
                      {planograms.map(p => (
                        <div 
                          key={p.name} 
                          onClick={() => setWizardData({...wizardData, shelfId: p.name, shelfName: p.display_name})}
                          className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${wizardData.shelfId === p.name ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                        >
                          <div className="font-medium text-foreground">{p.display_name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
              {step === 4 && (
                <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="flex items-center gap-2 text-lg font-semibold mb-6"><Calendar className="h-5 w-5 text-primary" /> Chi tiết hợp đồng</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-semibold mb-3 block">Chọn tầng áp dụng trưng bày độc quyền</label>
                      <div className="grid gap-3">
                        {selectedPlanogramDetail?.shelves?.map((row, i) => (
                          <label key={i} className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${wizardData.rows.includes(i) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                            <Checkbox checked={wizardData.rows.includes(i)} onCheckedChange={() => toggleRow(i)} />
                            <div className="flex-1">
                              <div className="font-medium">Tầng {i + 1}</div>
                              <div className="text-sm text-muted-foreground">Sức chứa: {row.length} sản phẩm</div>
                            </div>
                          </label>
                        )) || <p className="text-muted-foreground">Đang tải cấu trúc kệ...</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">Ngày bắt đầu</label>
                        <Input type="date" value={wizardData.startDate} onChange={e => setWizardData({...wizardData, startDate: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">Ngày kết thúc</label>
                        <Input type="date" value={wizardData.endDate} onChange={e => setWizardData({...wizardData, endDate: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="px-6 py-4 border-t flex justify-between bg-muted/10 shrink-0">
            <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : setIsModalOpen(false)}>
              {step > 1 ? 'Quay lại' : 'Hủy bỏ'}
            </Button>
            {step < 4 ? (
              <Button onClick={() => handleNextStep(step + 1)} disabled={
                (step === 1 && !wizardData.storeId) || 
                (step === 2 && !wizardData.brandName) || 
                (step === 3 && !wizardData.shelfId)
              }>Tiếp tục</Button>
            ) : (
              <Button onClick={submitContract}>Lưu Hợp Đồng</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
