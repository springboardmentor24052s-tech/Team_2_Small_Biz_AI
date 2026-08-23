import { useEffect, useMemo, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

import api from '../services/api'
import { Loading, PageHeader, EmptyState, Badge } from '../components/ui.jsx'

const COLORS = [
  '#3b5bdb',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
]

const SEGMENT_TONE = {
  'VIP Champions': 'green',
  'High Value Customers': 'blue',
  'At-Risk High Value Customers': 'amber',
  'Regular Customers': 'indigo',
  'New / Potential Customers': 'purple',
  'Budget Customers': 'slate',
  'Dormant Customers': 'red',
}

const SEGMENT_ACTIONS = {
  'VIP Champions': {
    icon: '🎁',
    action: 'Offer exclusive rewards and personalized offers.',
  },
  'High Value Customers': {
    icon: '📈',
    action: 'Encourage upsells and strengthen loyalty with targeted rewards.',
  },
  'At-Risk High Value Customers': {
    icon: '🔄',
    action: 'Send win-back offers and re-engagement campaigns.',
  },
  'Regular Customers': {
    icon: '🛍️',
    action: 'Use cross-sell and product recommendations to increase value.',
  },
  'Budget Customers': {
    icon: '🏷️',
    action: 'Offer targeted promotions, bundles, and value deals.',
  },
  'Dormant Customers': {
    icon: '📩',
    action: 'Run re-engagement campaigns to bring customers back.',
  },
  'New / Potential Customers': {
    icon: '🌱',
    action: 'Encourage their next purchase with personalized offers.',
  },
}

export default function Segmentation() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/ai/segmentation')
      .then((res) => setData(res.data))
      .catch((err) => console.error('Segmentation error:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Loading label="Running customer segmentation model..." />
  }

  const segments = data?.segments || []
  const customers = data?.customers || []

  if (segments.length === 0) {
    return (
      <div>
        <PageHeader
          title="Customer Segmentation"
          subtitle="AI-driven behavioral clustering based on customer purchasing patterns."
        />
        <EmptyState message="Not enough customer purchase history to build segments yet." />
      </div>
    )
  }

  // -----------------------------
  // Business KPIs
  // -----------------------------

  const totalCustomers = customers.length

  const totalRevenue = customers.reduce(
    (sum, customer) => sum + Number(customer.monetary || 0),
    0
  )

  const highestValueCustomer = customers.reduce(
    (max, customer) =>
      Number(customer.monetary || 0) > Number(max?.monetary || 0)
        ? customer
        : max,
    null
  )

  const largestSegment = segments.reduce(
    (largest, segment) =>
      Number(segment.customer_count || 0) >
      Number(largest?.customer_count || 0)
        ? segment
        : largest,
    null
  )

  // -----------------------------
  // Chart Data
  // -----------------------------

  const pieData = segments.map((segment) => ({
    name: segment.segment,
    value: segment.customer_count,
  }))

  const spendingData = [...segments]
    .sort(
      (a, b) =>
        Number(b.avg_purchase_value || 0) -
        Number(a.avg_purchase_value || 0)
    )
    .map((segment) => ({
      name: segment.segment,
      value: Number(segment.avg_purchase_value || 0),
    }))

  // -----------------------------
  // AI Insight
  // -----------------------------

  const vipSegment = segments.find(
    (segment) => segment.segment === 'VIP Champions'
  )

  const atRiskSegment = segments.find(
    (segment) => segment.segment === 'At-Risk High Value Customers'
  )

  let insightTitle = 'AI Segment Insight'
  let insightText =
    'Your customers are distributed across multiple behavioral segments. Use the segment groups to personalize offers and retention strategies.'

  if (vipSegment) {
    insightTitle = 'Your VIP customers are highly valuable'
    insightText = `${vipSegment.customer_count} VIP Champions generate an average purchase value of ₹${Number(
      vipSegment.avg_purchase_value || 0
    ).toLocaleString('en-IN')}. Consider loyalty rewards and personalized offers for this group.`
  } else if (atRiskSegment) {
    insightTitle = 'High-value customers may need attention'
    insightText = `${atRiskSegment.customer_count} customers are classified as At-Risk High Value Customers. Consider targeted retention campaigns before they become inactive.`
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Customer Segmentation"
        subtitle="AI-driven behavioral clustering based on customer purchasing patterns."
      />

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Segment Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>

              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={95}
                label={(entry) => `${entry.value}`}
              >

                {pieData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}

              </Pie>

              <Tooltip />

              <Legend
                verticalAlign="bottom"
                height={60}
              />

            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* SEGMENT SUMMARY */}
        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Segment Summary</h3>
          <div className="space-y-3">
            {segments.map((s) => (
              <div key={s.segment} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0">
                <div>
                  <Badge tone={SEGMENT_TONE[s.segment] || 'slate'}>{s.segment}</Badge>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.customer_count} customers</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    ₹{(s.avg_purchase_value ?? 0).toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="text-right text-sm">

                  <p className="font-semibold text-slate-800">
                    ₹{Number(
                      segment.avg_purchase_value || 0
                    ).toLocaleString('en-IN')}
                  </p>

                  <p className="text-xs text-slate-400">
                    avg. {segment.avg_purchase_frequency} orders
                  </p>

                </div>

              </div>
            ))}

          </div>

        </div>

      </div>

      {/* AVERAGE SPENDING CHART */}
      <div className="card">

        <div className="mb-5">
          <h3 className="font-semibold text-slate-800">
            Average Customer Value by Segment
          </h3>

          <p className="text-sm text-slate-500 mt-1">
            Compare the average spending behavior across customer groups.
          </p>
        </div>

        <ResponsiveContainer width="100%" height={360}>
          <BarChart
            data={spendingData}
            layout="vertical"
            margin={{
              top: 5,
              right: 30,
              left: 30,
              bottom: 5,
            }}
          >

            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
            />

            <XAxis
              type="number"
              tickFormatter={(value) =>
                `₹${Number(value).toLocaleString('en-IN')}`
              }
            />

            <YAxis
              type="category"
              dataKey="name"
              width={170}
              tick={{ fontSize: 12 }}
            />

            <Tooltip
              formatter={(value) =>
                `₹${Number(value).toLocaleString('en-IN')}`
              }
            />

            <Bar
              dataKey="value"
              name="Average Spend"
              fill="#3b5bdb"
              radius={[0, 6, 6, 0]}
            />

          </BarChart>
        </ResponsiveContainer>

      </div>





      {/* RECOMMENDED ACTIONS */}
      <div className="card">

        <div className="mb-5">
          <h3 className="font-semibold text-slate-800">
            Recommended Actions
          </h3>

          <p className="text-sm text-slate-500 mt-1">
            Suggested strategies for engaging each customer segment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {segments.map((segment) => {

            const recommendation =
              SEGMENT_ACTIONS[segment.segment] || {
                icon: '💡',
                action: 'Use targeted engagement based on customer behavior.',
              }

            return (
              <div
                key={segment.segment}
                className="border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-shadow"
              >

                <div className="flex items-start gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-xl">
                    {recommendation.icon}
                  </div>

                  <div className="min-w-0">

                    <Badge
                      tone={SEGMENT_TONE[segment.segment] || 'slate'}
                    >
                      {segment.segment}
                    </Badge>

                    <p className="text-sm text-slate-600 mt-3 leading-5">
                      {recommendation.action}
                    </p>

                  </div>

                </div>

              </div>
            )
          })}

        </div>

      </div>




      {/* CUSTOMER DETAIL */}
      <div className="card overflow-x-auto">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Customer Detail</h3>
        <table className="w-full text-sm">

          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Segment</th>
              <th className="py-2 pr-4">Orders</th>
              <th className="py-2 pr-4">Total Spent</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((c) => (
              <tr key={c.customer_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">{c.customer_name}</td>
                <td className="py-2 pr-4">
                  <Badge tone={SEGMENT_TONE[c.segment] || 'slate'}>{c.segment}</Badge>
                </td>

                <td className="py-3 pr-4">
                  <Badge
                    tone={
                      SEGMENT_TONE[customer.segment] || 'slate'
                    }
                  >
                    {customer.segment}
                  </Badge>
                </td>

                <td className="py-3 pr-4">
                  {customer.frequency ?? '—'}
                </td>

                <td className="py-3 pr-4 font-medium">
                  ₹{Number(
                    customer.monetary || 0
                  ).toLocaleString('en-IN')}
                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

    </div>
  )
}