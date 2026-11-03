"""Offline model build tool; not required by the Docker runtime.
Use onnxruntime==1.24.3, onnx==1.20.1, Pillow==12.1.1, numpy==2.5.4.
Calibrate an MIT-licensed FP32 export with the three public smoke-test rooms.
"""
import hashlib,json,pathlib,time
import numpy as np
from PIL import Image
from onnxruntime.quantization import CalibrationDataReader,QuantFormat,QuantType,quantize_static,CalibrationMethod
import onnxruntime as ort
root=pathlib.Path(__file__).resolve().parent.parent
source=root/'models/wall-segmentation.onnx'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='fea729ab6c5d338bc79ad3d986b073e6faa12c97255eafd78a1f7145326e534e'
photos=[root/'public/sample-room.jpg',root/'tests/fixtures/rooms/open-plan.jpg',root/'tests/fixtures/rooms/living-room.jpg']
def tensor(file):
 a=np.asarray(Image.open(file).convert('RGB').resize((512,512),Image.Resampling.BICUBIC),dtype=np.float32)/255
 return ((a-np.array([.485,.456,.406],np.float32))/np.array([.229,.224,.225],np.float32)).transpose(2,0,1)[None]
arrays=[tensor(file)for file in photos]
class Reader(CalibrationDataReader):
 def __init__(self):self.data=iter([{'pixel_values':a}for a in arrays])
 def get_next(self):return next(self.data,None)
output=root/'models/wall-segmentation-int8.onnx'
quantize_static(str(source),str(output),Reader(),quant_format=QuantFormat.QDQ,activation_type=QuantType.QUInt8,weight_type=QuantType.QInt8,per_channel=True,calibrate_method=CalibrationMethod.MinMax,op_types_to_quantize=['Conv','MatMul','Gemm'],extra_options={'ActivationSymmetric':False,'WeightSymmetric':True},calibration_providers=['CPUExecutionProvider'])
options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
reference=ort.InferenceSession(str(source),options,providers=['CPUExecutionProvider'])
quantized=ort.InferenceSession(str(output),options,providers=['CPUExecutionProvider'])
results=[]
for file,a in zip(photos,arrays):
 before=reference.run(None,{'pixel_values':a})[0].argmax(1)==0
 times=[]
 for _ in range(3):
  started=time.perf_counter();after=quantized.run(None,{'pixel_values':a})[0].argmax(1)==0;times.append(round((time.perf_counter()-started)*1000))
 overlap=float(np.logical_and(before,after).sum()/max(1,np.logical_or(before,after).sum()))
 results.append({'image':str(file.relative_to(root)),'wallMaskIoUVsFP32':overlap,'int8Ms':times})
report={'baseSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size,'calibration':'Three public room photographs; calibration-set comparison is not independent accuracy validation.','results':results}
(root/'docs/wall-quantization.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2),flush=True)
