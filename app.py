import pandas as pd
import numpy as np
from flask import Flask, render_template, request
import pickle
import joblib

# โหลดโมเดล
with open('rain_models_all.pkl', 'rb') as f:
    rain_models = pickle.load(f)

rice_mali_model = joblib.load('rice_mali_model.pkl')
glutinous_model = joblib.load('glutinous_rice_model.pkl')
province_encoder = joblib.load('province_label_encoder.pkl')

# จังหวัดที่ใช้
provinces = [p for p in ['ศรีสะเกษ', 'ร้อยเอ็ด', 'ยโสธร', 'สุรินทร์'] if p in province_encoder.classes_]

app = Flask(__name__)

@app.route('/', methods=['GET', 'POST'])
def index():
    prediction = None
    rain = None
    selected_province = None
    selected_year = None
    selected_month = None
    selected_rice_type = None

    if request.method == 'POST':
        action = request.form.get('action')

        if action == 'predict':
            # รับค่าจากฟอร์ม
            selected_province = request.form.get('province')
            selected_year = int(request.form.get('year'))
            selected_month = int(request.form.get('month'))
            selected_rice_type = request.form.get('rice_type')

            # ทำนายปริมาณฝน
            rain_model = rain_models[selected_province]['model']
            future = rain_model.make_future_dataframe(periods=60, freq='MS')
            future['month'] = future['ds'].dt.month
            future['sin_month'] = np.sin(2 * np.pi * future['month'] / 12)
            future['cos_month'] = np.cos(2 * np.pi * future['month'] / 12)
            forecast = rain_model.predict(future)
            forecast['yhat'] = np.expm1(forecast['yhat'])

            result = forecast[(forecast['ds'].dt.year == selected_year) & (forecast['ds'].dt.month == selected_month)]
            if not result.empty:
                rain = result.iloc[0]['yhat']
                encoded_province = province_encoder.transform([selected_province])[0]
                input_data = pd.DataFrame([[encoded_province, selected_year, selected_month, rain]],
                                          columns=['Province', 'YEAR', 'MONTH', 'Rainfall'])

                if selected_rice_type == "RiceMali":
                    prediction = rice_mali_model.predict(input_data)[0]
                elif selected_rice_type == "Long grain":
                    prediction = glutinous_model.predict(input_data)[0][0]
                else:
                    prediction = glutinous_model.predict(input_data)[0][1]

    # ส่งค่ากลับเฉพาะที่จำเป็นสำหรับการทำนาย
    return render_template(
        'index.html',
        provinces=provinces,
        selected_province=selected_province,
        selected_year=selected_year,
        selected_month=selected_month,
        selected_rice_type=selected_rice_type,
        prediction=prediction,
        rain=rain
    )


if __name__ == '__main__':
    app.run(debug=True)
