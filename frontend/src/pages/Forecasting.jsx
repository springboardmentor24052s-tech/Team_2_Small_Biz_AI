import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

import api from '../services/api'

import {
  Loading,
  PageHeader,
  StatCard,
  EmptyState,
} from '../components/ui.jsx'

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  IndianRupee,
  Activity,
  BarChart3,
} from 'lucide-react'

import { useTheme } from '../context/ThemeContext.jsx'


export default function Forecasting() {

  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const gridColor = isDark ? '#334155' : '#e2e8f0'

  const tooltipStyle = isDark
    ? {
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        color: '#e2e8f0',
      }
    : {
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        color: '#1e293b',
      }

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [horizon, setHorizon] = useState(14)


  // --------------------------------------------------
  // Fetch Forecast
  // --------------------------------------------------

  useEffect(() => {

    let isMounted = true

    setLoading(true)

    api
      .get(`/ai/forecast?horizon_days=${horizon}`)
      .then((res) => {

        console.log('Forecast API response:', res.data)

        if (isMounted) {
          setData(res.data)
        }

      })
      .catch((err) => {

        console.error(
          'Forecasting error:',
          err?.response?.data || err
        )

        if (isMounted) {
          setData(null)
        }

      })
      .finally(() => {

        if (isMounted) {
          setLoading(false)
        }

      })

    return () => {
      isMounted = false
    }

  }, [horizon])


  // --------------------------------------------------
  // Horizon Change
  // --------------------------------------------------

  const handleHorizonChange = (days) => {

    if (days !== horizon) {
      setHorizon(days)
    }

  }


  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {

    return (
      <Loading
        label="Running forecasting model..."
      />
    )

  }


  // --------------------------------------------------
  // Empty / Insufficient Data
  // --------------------------------------------------

  if (
    !data ||
    !data.forecast ||
    data.forecast.length === 0
  ) {

    return (
      <div>

        <PageHeader
          title="Sales Forecasting"
          subtitle="AI-powered sales revenue forecasting."
        />

        <EmptyState
          message={
            data?.trend === 'insufficient_data'
              ? 'Not enough historical sales data yet to generate a forecast.'
              : 'Unable to generate a sales forecast.'
          }
        />

      </div>
    )

  }


  // --------------------------------------------------
  // Data
  // --------------------------------------------------

  const history = Array.isArray(data.history)
    ? data.history
    : []

  const forecast = Array.isArray(data.forecast)
    ? data.forecast
    : []


  // --------------------------------------------------
  // Revenue Calculations
  // --------------------------------------------------

  const historicalRevenue = history.map(
    (item) => Number(item.revenue || 0)
  )

  const forecastRevenue = forecast.map(
    (item) => Number(item.predicted_revenue || 0)
  )


  // Last 7 historical days
  const recentHistoricalRevenue =
    historicalRevenue.length >= 7
      ? historicalRevenue.slice(-7)
      : historicalRevenue


  const historicalAverage =
    recentHistoricalRevenue.length > 0
      ? recentHistoricalRevenue.reduce(
          (sum, value) => sum + value,
          0
        ) / recentHistoricalRevenue.length
      : 0


  const forecastAverage =
    forecastRevenue.length > 0
      ? forecastRevenue.reduce(
          (sum, value) => sum + value,
          0
        ) / forecastRevenue.length
      : 0


  const totalForecastRevenue =
    forecastRevenue.reduce(
      (sum, value) => sum + value,
      0
    )


  // --------------------------------------------------
  // Growth
  // --------------------------------------------------

  const growthPercentage =
    historicalAverage > 0
      ? (
          ((forecastAverage - historicalAverage) /
            historicalAverage) *
          100
        )
      : Number(data.growth_pct || 0)


  // --------------------------------------------------
  // Trend
  // --------------------------------------------------

  let trend = data.trend || 'stable'

  if (
    trend !== 'increasing' &&
    trend !== 'decreasing' &&
    trend !== 'stable'
  ) {
    trend = 'stable'
  }


  // --------------------------------------------------
  // Trend Icons
  // --------------------------------------------------

  const TREND_ICON = {
    increasing: TrendingUp,
    decreasing: TrendingDown,
    stable: Minus,
  }


  const TREND_TONE = {
    increasing: 'green',
    decreasing: 'red',
    stable: 'brand',
  }


  const TrendIcon =
    TREND_ICON[trend] || Minus


  // --------------------------------------------------
  // Forecast Insight
  // --------------------------------------------------

  let forecastInsightTitle
  let forecastInsight


  if (trend === 'increasing') {

    forecastInsightTitle =
      'Sales revenue is expected to increase'

    forecastInsight =
      `Forecasted daily revenue is approximately ${Math.abs(
        growthPercentage
      ).toFixed(
        1
      )}% higher than the recent historical average. Consider preparing inventory and resources for higher demand.`

  } else if (trend === 'decreasing') {

    forecastInsightTitle =
      'Sales revenue may slow down'

    forecastInsight =
      `Forecasted daily revenue is approximately ${Math.abs(
        growthPercentage
      ).toFixed(
        1
      )}% below the recent historical average. Consider reviewing inventory, promotions, and sales activity.`

  } else {

    forecastInsightTitle =
      'Sales revenue is expected to remain stable'

    forecastInsight =
      'Forecasted daily revenue is close to the recent historical average, suggesting relatively stable demand over the forecast period.'

  }


  // --------------------------------------------------
  // Chart Data
  // --------------------------------------------------

  const chartData = [

    ...history.map((item) => ({
      period: item.date,
      actual: Number(item.revenue || 0),
      forecast: null,
    })),

    ...forecast.map((item) => ({
      period: item.period,
      actual: null,
      forecast: Number(
        item.predicted_revenue || 0
      ),
    })),

  ]


  // --------------------------------------------------
  // Currency Formatter
  // --------------------------------------------------

  const formatCurrency = (value) => {

    return `₹${Number(value || 0).toLocaleString(
      'en-IN',
      {
        maximumFractionDigits: 0,
      }
    )}`

  }


  const formatCurrencyDecimal = (value) => {

    return `₹${Number(value || 0).toLocaleString(
      'en-IN',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`

  }


  // --------------------------------------------------
  // Chart Tooltip
  // --------------------------------------------------

  const CustomTooltip = ({
    active,
    payload,
    label,
  }) => {

    if (
      !active ||
      !payload ||
      payload.length === 0
    ) {
      return null
    }

    return (
      <div
        style={tooltipStyle}
        className="rounded-lg px-3 py-2 shadow-lg"
      >

        <p className="text-xs font-medium mb-1">
          {label}
        </p>

        {payload.map((entry, index) => (

          <p
            key={index}
            className="text-sm"
          >
            <span className="font-medium">
              {entry.name}:
            </span>{' '}
            {formatCurrencyDecimal(
              entry.value
            )}
          </p>

        ))}

      </div>
    )

  }


  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (

    <div>

      {/* ==================================================
          PAGE HEADER
      ================================================== */}

      <PageHeader
        title="Sales Forecasting"
        subtitle="Time-series forecasting engine using machine learning trained on daily revenue trends."
      />


      {/* ==================================================
          STAT CARDS
      ================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">


        {/* Forecast Horizon */}

        <StatCard
          label="Forecast Horizon"
          value={`${horizon} Days`}
          icon={Target}
          tone="brand"
        />


        {/* Total Forecast Revenue */}

        <StatCard
          label="Forecast Revenue"
          value={formatCurrency(
            totalForecastRevenue
          )}
          sub="Total predicted revenue"
          icon={IndianRupee}
          tone="green"
        />


        {/* Average Daily Revenue */}

        <StatCard
          label="Avg. Daily Forecast"
          value={formatCurrency(
            forecastAverage
          )}
          sub="Predicted revenue per day"
          icon={BarChart3}
          tone="brand"
        />


        {/* Trend */}

        <StatCard
          label="Forecast Trend"
          value={
            trend.charAt(0).toUpperCase() +
            trend.slice(1)
          }
          sub={
            `${
              growthPercentage >= 0
                ? '+'
                : ''
            }${growthPercentage.toFixed(
              1
            )}% vs recent history`
          }
          icon={TrendIcon}
          tone={TREND_TONE[trend]}
        />

      </div>


      {/* ==================================================
          FORECAST INSIGHT
      ================================================== */}

      <div className="card mb-6">

        <div className="flex items-start gap-4">

          <div
            className="
              flex-shrink-0
              w-10
              h-10
              rounded-full
              bg-blue-50
              dark:bg-blue-900/30
              flex
              items-center
              justify-center
              text-xl
            "
          >
            📊
          </div>


          <div>

            <h3
              className="
                font-semibold
                text-slate-800
                dark:text-slate-100
              "
            >
              {forecastInsightTitle}
            </h3>


            <p
              className="
                text-sm
                text-slate-500
                dark:text-slate-400
                mt-1
              "
            >
              {forecastInsight}
            </p>

          </div>

        </div>

      </div>


      {/* ==================================================
          FORECAST CHART
      ================================================== */}

      <div className="card">

        <div
          className="
            flex
            flex-col
            sm:flex-row
            sm:items-center
            sm:justify-between
            gap-3
            mb-4
          "
        >

          <div>

            <h3
              className="
                font-semibold
                text-slate-800
                dark:text-slate-100
              "
            >
              Revenue: History vs. Forecast
            </h3>


            <p
              className="
                text-xs
                text-slate-500
                dark:text-slate-400
                mt-1
              "
            >
              Historical daily revenue compared
              with AI-predicted future revenue.
            </p>

          </div>


          {/* Horizon Selection */}

          <div
            className="
              flex
              items-center
              gap-1
              bg-slate-100
              p-1
              rounded-lg
              text-xs
              font-medium
              dark:bg-slate-800
            "
          >

            <span
              className="
                text-slate-400
                px-1
                dark:text-slate-500
              "
            >
              Horizon:
            </span>


            {[7, 14, 30].map((days) => (

              <button
                key={days}
                type="button"
                onClick={() =>
                  handleHorizonChange(days)
                }
                className={`
                  px-2.5
                  py-1
                  rounded-md
                  transition-all

                  ${
                    horizon === days
                      ? `
                        bg-white
                        dark:bg-slate-700
                        text-slate-800
                        dark:text-slate-100
                        shadow-sm
                        font-semibold
                      `
                      : `
                        text-slate-500
                        dark:text-slate-400
                        hover:text-slate-800
                        dark:hover:text-slate-100
                      `
                  }
                `}
              >
                {days} Days
              </button>

            ))}

          </div>

        </div>


        {/* Chart */}

        <ResponsiveContainer
          width="100%"
          height={340}
        >

          <LineChart
            data={chartData}
            margin={{
              top: 10,
              right: 20,
              left: 10,
              bottom: 10,
            }}
          >

            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
            />


            <XAxis
              dataKey="period"
              tick={{
                fontSize: 10,
                fill: axisColor,
              }}
              interval="preserveStartEnd"
            />


            <YAxis
              tick={{
                fontSize: 11,
                fill: axisColor,
              }}
              tickFormatter={(value) =>
                `₹${Number(
                  value
                ).toLocaleString('en-IN')}`
              }
            />


            <Tooltip
              content={<CustomTooltip />}
            />


            <Legend
              wrapperStyle={
                isDark
                  ? {
                      color: '#cbd5e1',
                    }
                  : undefined
              }
            />


            {/* Historical Revenue */}

            <Line
              type="monotone"
              dataKey="actual"
              name="Actual Revenue"
              stroke="#3b5bdb"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />


            {/* Forecast Revenue */}

            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecasted Revenue"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls={false}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>


      {/* ==================================================
          FORECAST SUMMARY
      ================================================== */}

      <div
        className="
          grid
          grid-cols-1
          lg:grid-cols-3
          gap-4
          mt-6
        "
      >


        {/* Last Historical Date */}

        <div className="card">

          <div className="flex items-center gap-3">

            <div
              className="
                w-9
                h-9
                rounded-lg
                bg-slate-100
                dark:bg-slate-800
                flex
                items-center
                justify-center
              "
            >
              <Activity
                size={18}
                className="
                  text-slate-500
                  dark:text-slate-400
                "
              />
            </div>


            <div>

              <p
                className="
                  text-sm
                  text-slate-500
                  dark:text-slate-400
                "
              >
                Last Historical Date
              </p>


              <p
                className="
                  text-xl
                  font-semibold
                  text-slate-800
                  dark:text-slate-100
                  mt-1
                "
              >
                {history.length > 0
                  ? history[
                      history.length - 1
                    ].date
                  : '—'}
              </p>

            </div>

          </div>

        </div>


        {/* Historical Average */}

        <div className="card">

          <p
            className="
              text-sm
              text-slate-500
              dark:text-slate-400
            "
          >
            Historical Daily Average
          </p>


          <p
            className="
              text-xl
              font-semibold
              text-slate-800
              dark:text-slate-100
              mt-1
            "
          >
            {formatCurrency(
              historicalAverage
            )}
          </p>


          <p
            className="
              text-xs
              text-slate-400
              mt-1
            "
          >
            Average revenue per day
          </p>

        </div>


        {/* Predicted Average */}

        <div className="card">

          <p
            className="
              text-sm
              text-slate-500
              dark:text-slate-400
            "
          >
            Predicted Daily Average
          </p>


          <p
            className="
              text-xl
              font-semibold
              text-slate-800
              dark:text-slate-100
              mt-1
            "
          >
            {formatCurrency(
              forecastAverage
            )}
          </p>


          <p
            className="
              text-xs
              text-slate-400
              mt-1
            "
          >
            Expected revenue per day
          </p>

        </div>

      </div>


      {/* ==================================================
          MODEL PERFORMANCE
      ================================================== */}

      <div className="card mt-6">

        <div className="mb-4">

          <h3
            className="
              font-semibold
              text-slate-800
              dark:text-slate-100
            "
          >
            Model Performance
          </h3>


          <p
            className="
              text-xs
              text-slate-500
              dark:text-slate-400
              mt-1
            "
          >
            Quantitative evaluation metrics calculated
            on the held-out historical data.
          </p>

        </div>


        <div
          className="
            grid
            grid-cols-1
            sm:grid-cols-3
            gap-4
          "
        >

          {/* MAE */}

          <div
            className="
              rounded-lg
              border
              border-slate-200
              dark:border-slate-700
              p-4
            "
          >

            <p
              className="
                text-xs
                text-slate-500
                dark:text-slate-400
              "
            >
              Mean Absolute Error
            </p>


            <p
              className="
                text-lg
                font-semibold
                text-slate-800
                dark:text-slate-100
                mt-1
              "
            >
              {data.mae !== null &&
              data.mae !== undefined
                ? formatCurrencyDecimal(
                    data.mae
                  )
                : 'N/A'}
            </p>

          </div>


          {/* RMSE */}

          <div
            className="
              rounded-lg
              border
              border-slate-200
              dark:border-slate-700
              p-4
            "
          >

            <p
              className="
                text-xs
                text-slate-500
                dark:text-slate-400
              "
            >
              Root Mean Squared Error
            </p>


            <p
              className="
                text-lg
                font-semibold
                text-slate-800
                dark:text-slate-100
                mt-1
              "
            >
              {data.rmse !== null &&
              data.rmse !== undefined
                ? formatCurrencyDecimal(
                    data.rmse
                  )
                : 'N/A'}
            </p>

          </div>


          {/* R2 */}

          <div
            className="
              rounded-lg
              border
              border-slate-200
              dark:border-slate-700
              p-4
            "
          >

            <p
              className="
                text-xs
                text-slate-500
                dark:text-slate-400
              "
            >
              R² Score
            </p>


            <p
              className="
                text-lg
                font-semibold
                text-slate-800
                dark:text-slate-100
                mt-1
              "
            >
              {data.r2 !== null &&
              data.r2 !== undefined
                ? data.r2
                : 'N/A'}
            </p>

          </div>

        </div>

      </div>


      {/* ==================================================
          DAILY FORECAST DETAILS
      ================================================== */}

      <div className="card mt-6">

        <div className="mb-4">

          <h3
            className="
              font-semibold
              text-slate-800
              dark:text-slate-100
            "
          >
            Daily Forecast Details
          </h3>


          <p
            className="
              text-xs
              text-slate-500
              dark:text-slate-400
              mt-1
            "
          >
            Predicted revenue for each upcoming day.
          </p>

        </div>


        <div
          className="
            overflow-x-auto
            max-h-[420px]
            overflow-y-auto
          "
        >

          <table className="w-full text-sm">

            <thead>

              <tr
                className="
                  border-b
                  border-slate-200
                  dark:border-slate-700
                "
              >

                <th
                  className="
                    text-left
                    py-3
                    px-3
                    font-semibold
                    text-slate-600
                    dark:text-slate-300
                  "
                >
                  Date
                </th>


                <th
                  className="
                    text-right
                    py-3
                    px-3
                    font-semibold
                    text-slate-600
                    dark:text-slate-300
                  "
                >
                  Predicted Revenue
                </th>


                <th
                  className="
                    text-right
                    py-3
                    px-3
                    font-semibold
                    text-slate-600
                    dark:text-slate-300
                  "
                >
                  Change
                </th>


                <th
                  className="
                    text-right
                    py-3
                    px-3
                    font-semibold
                    text-slate-600
                    dark:text-slate-300
                  "
                >
                  Status
                </th>

              </tr>

            </thead>


            <tbody>

              {forecast.map(
                (item, index) => {

                  const currentRevenue =
                    Number(
                      item.predicted_revenue ||
                        0
                    )


                  const previousRevenue =
                    index === 0
                      ? historicalRevenue[
                          historicalRevenue.length -
                            1
                        ] || 0
                      : Number(
                          forecast[
                            index - 1
                          ]
                            .predicted_revenue ||
                            0
                        )


                  const change =
                    previousRevenue > 0
                      ? (
                          ((currentRevenue -
                            previousRevenue) /
                            previousRevenue) *
                          100
                        )
                      : 0


                  let status = 'Normal'


                  if (
                    currentRevenue >
                    forecastAverage * 1.1
                  ) {

                    status = 'High'

                  } else if (
                    currentRevenue <
                    forecastAverage * 0.9
                  ) {

                    status = 'Low'

                  }


                  return (

                    <tr
                      key={
                        item.period ||
                        index
                      }
                      className="
                        border-b
                        border-slate-100
                        dark:border-slate-800
                      "
                    >

                      {/* Date */}

                      <td
                        className="
                          py-3
                          px-3
                          text-slate-700
                          dark:text-slate-200
                        "
                      >
                        {item.period}
                      </td>


                      {/* Revenue */}

                      <td
                        className="
                          py-3
                          px-3
                          text-right
                          font-medium
                          text-slate-800
                          dark:text-slate-100
                        "
                      >
                        {formatCurrencyDecimal(
                          currentRevenue
                        )}
                      </td>


                      {/* Change */}

                      <td
                        className={`
                          py-3
                          px-3
                          text-right
                          font-medium

                          ${
                            change > 0
                              ? 'text-green-600'
                              : change < 0
                              ? 'text-red-600'
                              : 'text-slate-500'
                          }
                        `}
                      >

                        {index === 0 ? (

                          '—'

                        ) : (

                          <>
                            {change > 0
                              ? '↑'
                              : change < 0
                              ? '↓'
                              : '→'}{' '}

                            {Math.abs(
                              change
                            ).toFixed(1)}
                            %
                          </>

                        )}

                      </td>


                      {/* Status */}

                      <td
                        className="
                          py-3
                          px-3
                          text-right
                        "
                      >

                        <span
                          className={`
                            inline-flex
                            items-center
                            px-2.5
                            py-1
                            rounded-full
                            text-xs
                            font-medium

                            ${
                              status === 'High'
                                ? `
                                  bg-green-100
                                  text-green-700
                                  dark:bg-green-900/30
                                  dark:text-green-400
                                `
                                : status === 'Low'
                                ? `
                                  bg-red-100
                                  text-red-700
                                  dark:bg-red-900/30
                                  dark:text-red-400
                                `
                                : `
                                  bg-slate-100
                                  text-slate-600
                                  dark:bg-slate-800
                                  dark:text-slate-300
                                `
                            }
                          `}
                        >
                          {status}
                        </span>

                      </td>

                    </tr>

                  )

                }
              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>

  )

}