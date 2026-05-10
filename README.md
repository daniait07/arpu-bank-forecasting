 # ARPU Bank Forecasting

Система краткосрочного прогнозирования дневного ARPU банка на горизонте 1-7 дней.
Сравниваются статистические модели: SARIMA, SARIMAX, Holt-Winters и методы
машинного обучения: Random Forest, XGBoost, LightGBM, Ridge, Lasso, ElasticNet
на реальных банковских данных за 2024-2026 гг.

Лучший результат: Random Forest - MAE=3.36 руб/день, MAPE=1.63%, R2=0.896
Превосходит лучший опубликованный результат (Au et al., 2022) на 44% по MAPE.

## Функционал

- Дашборд: история ARPU 2024-2026, структура выручки, сравнение 11 моделей
- Прогноз: горизонт 1/3/7 дней, 95% доверительный интервал, тест Диболда-Мариано
- What-if анализ: 15 параметров, фильтр по сегменту, SHAP-интерпретация в рублях
- Bootstrap CI (B=500) для оценки неопределенности прогноза
- Rolling Origin Evaluation на 5 окнах для проверки устойчивости моделей

## Стек

Backend: FastAPI + Uvicorn + scikit-learn + LightGBM + XGBoost + SHAP + Optuna
Frontend: React 18 + Vite + Recharts
Deploy: Docker Compose + Nginx
Data: Oracle Database -> SQLite (12.4M строк, 98 признаков)

## Результаты

| Модель        | MAE  | RMSE | MAPE  | R2    | vs Au et al. 2022 |
|---------------|------|------|-------|-------|-------------------|
| Random Forest | 3.36 | 6.00 | 1.63% | 0.896 | +44%              |
| XGBoost       | 3.71 | 6.23 | 1.83% | 0.887 | +37%              |
| Lasso         | 3.86 | 6.67 | 1.87% | 0.871 | +36%              |
| Ridge         | 3.98 | 6.92 | 1.94% | 0.861 | +33%              |
| SARIMAX       | 4.26 | 8.01 | 2.09% | 0.814 | +28%              |
| SARIMA        | 5.11 | 9.65 | 2.52% | 0.730 | -                 |
| LightGBM      | 5.28 | 9.42 | 2.67% | 0.742 | -                 |

Тест Диболда-Мариано: RF vs LightGBM p=0.003, все ML vs Baseline p<0.001

## Данные

- 50 000 клиентов x 821 день = 12.4 млн строк
- 98 признаков после feature engineering
- Период: 01.01.2024 - 31.03.2026
- Разбиение: 70% train / 15% val / 15% test (строго по времени)

## Запуск через Docker

```bash
# Необходимо положить data_bundle.pkl и models_bundle.pkl в корень проекта
docker-compose up --build
# Открыть http://localhost:3000
```

## Запуск локально

```bash
# Терминал 1 - бэкенд
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Терминал 2 - фронтенд
cd frontend
npm install
npm run dev
# Открыть http://localhost:5173
```

## Структура

arpu-dashboard/
├── backend/
│   ├── main.py                    FastAPI приложение, все эндпоинты
│   ├── requirements.txt           Python зависимости
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      Дашборд - KPI, графики, таблица моделей
│   │   │   ├── Dashboard.css
│   │   │   ├── Forecast.jsx       Прогноз - выбор модели, горизонта, DM-тест
│   │   │   ├── Forecast.css
│   │   │   ├── WhatIf.jsx         What-if анализ - слайдеры, SHAP-водопад
│   │   │   └── WhatIf.css
│   │   ├── components/
│   │   │   ├── KpiCard.jsx        Карточка KPI
│   │   │   ├── KpiCard.css
│   │   │   ├── Sidebar.jsx        Боковая навигация
│   │   │   ├── Sidebar.css
│   │   │   ├── LoadingSpinner.jsx Индикатор загрузки
│   │   │   └── LoadingSpinner.css
│   │   ├── App.jsx                Роутинг
│   │   ├── api.js                 HTTP клиент
│   │   ├── main.jsx               Точка входа
│   │   └── index.css              Глобальные стили
│   ├── index.html
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── notebooks/
│   └── arpu_bank_forecasting.ipynb   EDA + обучение + валидация
├── data_bundle.pkl               не в репо - генерируется ноутбуком
├── models_bundle.pkl             не в репо - генерируется ноутбуком
├── banking_arpu.db               не в репо - 5.7 ГБ исходные данные
├── docker-compose.yml
├── .gitignore
└── README.md
