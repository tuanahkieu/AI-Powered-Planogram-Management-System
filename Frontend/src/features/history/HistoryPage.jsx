import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, X, RefreshCw } from 'lucide-react';
import { API } from '../../utils/shared.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function HistoryPage() {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalLog, setModalLog] = useState(null);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStore) fetchLogs();
  }, [selectedStore]);

  const fetchStores = async () => {
    try {
      const res = await fetch(`${API}/api/stores`);
      const data = await res.json();
      if (data.success) {
        setStores(data.stores);
        if (data.stores.length > 0 && !selectedStore) {
          setSelectedStore(data.stores[0].store_id);
        }
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/compliance-logs?store_id=${selectedStore}&limit=50`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteLog = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch sử này không?')) return;
    
    try {
      const res = await fetch(`${API}/api/compliance-logs/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setLogs(prev => prev.filter(l => l._id !== id));
        if (modalLog?._id === id) setModalLog(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight gradient-ai-text">Lịch Sử Phân Tích</h1>
          <p className="text-muted-foreground mt-2">Xem lại kết quả quét tự động và đánh giá AI</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="-- Chọn cửa hàng --" />
            </SelectTrigger>
            <SelectContent>
              {stores.map(s => <SelectItem key={s.store_id} value={s.store_id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-primary' : ''}`} />
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-24 text-center text-muted-foreground flex flex-col items-center">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
              Đang tải lịch sử...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-24 text-center text-muted-foreground">
              Chưa có lịch sử kiểm tra nào cho cửa hàng này.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Thời gian</TableHead>
                  <TableHead>Tên kệ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Chi tiết</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {logs.map(log => {
                    const dateObj = new Date(log.checked_at + 'Z');
                    const passed = log.status === 'PASSED';
                    return (
                      <TableRow 
                        key={log._id}
                        onClick={() => setModalLog(log)}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-medium text-muted-foreground">{dateObj.toLocaleString('vi-VN')}</TableCell>
                        <TableCell className="font-semibold">{log.planogram_display_name || 'Không rõ'}</TableCell>
                        <TableCell>
                          <Badge variant={passed ? "default" : "destructive"} className={passed ? "bg-green-500 hover:bg-green-600" : ""}>
                            {passed ? 'Đạt' : 'Có lỗi'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{log.issues ? log.issues.length : 0} lỗi</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={(e) => deleteLog(log._id, e)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!modalLog} onOpenChange={(open) => !open && setModalLog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="text-xl">
              Chi Tiết - {modalLog?.planogram_display_name} 
              <span className="text-muted-foreground font-normal ml-2 text-sm">
                ({modalLog && new Date(modalLog.checked_at + 'Z').toLocaleString('vi-VN')})
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-4">
              <h4 className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Hình ảnh AI phân tích</h4>
              {modalLog?.annotated_image ? (
                <div className="rounded-xl overflow-hidden border shadow-sm">
                  <img src={modalLog.annotated_image} className="w-full object-contain bg-muted" alt="Annotated" />
                </div>
              ) : (
                <div className="p-12 bg-muted/30 border rounded-xl flex items-center justify-center text-muted-foreground">
                  Không có ảnh
                </div>
              )}
            </div>
            
            <div className="flex-1 flex flex-col space-y-4">
              <h4 className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Danh sách lỗi phát hiện</h4>
              
              <div className="flex-1">
                {modalLog?.issues && modalLog.issues.length > 0 ? (
                  <ul className="space-y-3">
                    {modalLog.issues.map((iss, i) => (
                      <li key={i} className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm flex gap-2">
                        <span className="mt-0.5 font-bold">•</span>
                        {iss}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 bg-green-500/10 text-green-600 border border-green-500/20 rounded-lg text-sm font-medium">
                    Không phát hiện lỗi. Kệ hàng đạt chuẩn 100%!
                  </div>
                )}
              </div>
              
              <div className="pt-6 border-t mt-auto">
                <Button variant="destructive" className="w-full" onClick={() => deleteLog(modalLog._id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Xóa bản ghi này
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
