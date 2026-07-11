import React from 'react';

export default function PlanogramPage() {
  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
      <iframe 
        src="/planogram-raw.html" 
        style={{ width: '100%', height: '100%', border: 'none' }} 
        title="Planogram Builder"
      />
    </div>
  );
}
