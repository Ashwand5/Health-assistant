import numpy as np
from tensorflow.keras.preprocessing.image import load_img, img_to_array
import matplotlib.pyplot as plt
from keras.layers import TFSMLayer

# File paths
model_path = "D:/Users 2.o/PY charm/flask/chatbot/medical-bot-backend/model/final_v1_xception_savedmodel"
image_path = "D:/Users 2.o/PY charm/flask/chatbot/medical-bot-backend/download.jpg"

# Load model for inference
model = TFSMLayer(model_path, call_endpoint='serving_default')
print("Model loaded successfully.")

# Class labels
class_labels = [
    'Aloo_matar', 'Besan_cheela', 'Biryani', 'Chapathi', 'Chole_bature',
    'Dahl', 'Dhokla', 'Dosa', 'Gulab_jamun', 'Idli',
    'Jalebi', 'Kadai_paneer', 'Naan', 'Paani_puri', 'Pakoda',
    'Pav_bhaji', 'Poha', 'Rolls', 'Samosa', 'Vada_pav'
]

# Preprocessing
def preprocess_image_manual(image_path, target_size=(224, 224)):
    img = load_img(image_path, target_size=target_size)
    img_array = img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = img_array / 255.0
    return img_array

processed_image = preprocess_image_manual(image_path)

# Predict
outputs = model(processed_image, training=False)
predictions = list(outputs.values())[0].numpy()

predicted_class_index = np.argmax(predictions, axis=1)[0]
predicted_class_label = class_labels[predicted_class_index]
confidence = predictions[0][predicted_class_index] * 100

# Display
print(f"Predicted Food: {predicted_class_label}")
print(f"Confidence: {confidence:.2f}%")

img = load_img(image_path)
plt.imshow(img)
plt.title(f"Predicted: {predicted_class_label} ({confidence:.2f}%)")
plt.axis('off')
plt.show()

# Top 5
top_5_indices = np.argsort(predictions[0])[-5:][::-1]
print("\nTop 5 Predictions:")
for idx in top_5_indices:
    print(f"{class_labels[idx]}: {predictions[0][idx]*100:.2f}%")
