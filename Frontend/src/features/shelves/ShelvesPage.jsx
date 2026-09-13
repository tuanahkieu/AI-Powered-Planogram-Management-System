import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Trash2, Edit, Layers } from 'lucide-react';
import { API } from '../../utils/shared.js';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ShelvesPage() {
  const [storesMap, setStoresMap] = useState({});
  const [groupedShelves, setGroupedShelves] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pogRes, storeRes] = await Promise.all([
        fetch(`${API}/api/planograms`),
        fetch(`${API}/api/stores`).catch(() => ({ json: () => ({ success: false }) }))
      ]);
      const data = await pogRes.json();
      const storeData = await storeRes.json();
      
      const sMap = {};
      if (storeData.success && storeData.stores) {
        storeData.stores.forEach(s => sMap[s.store_id] = s.name);
      }
      setStoresMap(sMap);

      const items = data.source === 'mongodb' ? data.data : [];
      const grouped = {};
      items.forEach(item => {
        const sid = item.store_id || 'unassigned';
        if (!grouped[sid]) grouped[sid] = [];
        grouped[sid].push(item);
      });
      setGroupedShelves(grouped);
      
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteShelf = async (name) => {
    if (!window.confirm(`Xóa kệ: ${name}?`)) return;
    try {
      const res = await fetch(`${API}/api/planograms/${name}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight gradient-ai-text">Quản Lý Kệ Hàng</h1>
          <p className="text-muted-foreground mt-2">Quản lý không gian trưng bày tại các cửa hàng</p>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">Đang tải cấu trúc kệ...</div>
      ) : Object.keys(groupedShelves).length === 0 ? (
        <div className="py-24 text-center text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
          Chưa có kệ nào. Hãy tạo planogram mới!
        </div>
      ) : (
        <div className="space-y-12">
          {Object.keys(groupedShelves).map(sid => {
            const storeName = storesMap[sid] || (sid === 'unassigned' ? 'Chưa phân bổ cơ sở' : sid);
            return (
              <div key={sid} className="space-y-6">
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                  <Store className="text-primary h-6 w-6" /> {storeName}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <AnimatePresence>
                    {groupedShelves[sid].map((item, idx) => {
                      const totalProducts = item.shelves ? item.shelves.reduce((sum, row) => sum + row.length, 0) : 0;
                      return (
                        <motion.div 
                          key={item.name}
                          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ delay: idx * 0.05 }}
                        >
                          <Card className="h-full flex flex-col hover:shadow-md transition-all border-border">
                            <CardHeader className="pb-4">
                              <div className="flex gap-4 items-center">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                                  {String(idx + 1).padStart(2, '0')}
                                </div>
                                <div>
                                  <CardTitle className="text-lg">{item.display_name}</CardTitle>
                                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                    <Layers className="w-3.5 h-3.5" /> {item.shelves?.length || 0} tầng
                                  </div>
                                </div>
                              </div>
                            </CardHeader>
                            
                            <CardContent className="flex-1 pb-4 space-y-2">
                              {item.shelves?.map((row, i) => (
                                <div key={i} className="flex justify-between items-center py-2 border-b border-muted last:border-0">
                                  <span className="text-sm text-muted-foreground">Tầng {i + 1}</span>
                                  <Badge variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/10">
                                    {row.length} SP
                                  </Badge>
                                </div>
                              ))}
                            </CardContent>

                            <CardFooter className="pt-4 border-t flex flex-col space-y-4">
                              <div className="w-full flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Tổng dung lượng:</span>
                                <span className="font-bold text-foreground">{totalProducts} sản phẩm</span>
                              </div>
                              <div className="w-full flex gap-2">
                                <Button variant="outline" className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteShelf(item.name)}>
                                  <Trash2 className="w-4 h-4 mr-2" /> Xóa
                                </Button>
                                <Button className="flex-1" onClick={() => navigate(`/planogram?load=${item.name}`)}>
                                  <Edit className="w-4 h-4 mr-2" /> Sửa
                                </Button>
                              </div>
                            </CardFooter>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
