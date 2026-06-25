import torch
from ultralytics import YOLO

# Bypass PyTorch 2.6+ weights_only restriction cleanly
_original_load = torch.load
def _custom_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)
torch.load = _custom_load

try:
    model = YOLO('best.pt')
    print("Labels in model:", model.names)
except Exception as e:
    print("Error:", e)
