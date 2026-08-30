import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'

import {
  Loading,
  PageHeader,
  Badge,
  EmptyState,
  ErrorBanner,
} from '../components/ui.jsx'

import InteractiveTable, {
  DetailModal,
} from '../components/InteractiveTable.jsx'

import {
  Tags,
  Plus,
  Trash2,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext.jsx'


export default function Categories() {

  const { hasRole } = useAuth()

  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])

  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)

  const [categoryName, setCategoryName] = useState('')
  const [description, setDescription] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)

  const [selected, setSelected] = useState(null)


  // ============================================================
  // ROLE PERMISSION
  // ============================================================

  const canManageCategories = hasRole(
    'business_owner',
    'store_manager',
    'admin'
  )


  // ============================================================
  // LOAD CATEGORIES + PRODUCTS
  // ============================================================

  const load = useCallback(async () => {

    setLoading(true)
    setError(null)

    try {

      const [
        categoriesResponse,
        productsResponse,
      ] = await Promise.all([
        api.get('/categories/'),

        api
          .get('/inventory/products')
          .catch(() => ({
            data: [],
          })),
      ])


      setCategories(
        Array.isArray(categoriesResponse.data)
          ? categoriesResponse.data
          : []
      )


      setProducts(
        Array.isArray(productsResponse.data)
          ? productsResponse.data
          : []
      )

    } catch (err) {

      setError(
        err.response?.data?.detail ||
        err.message ||
        'Failed to load categories.'
      )

    } finally {

      setLoading(false)

    }

  }, [])


  useEffect(() => {
    load()
  }, [load])


  // ============================================================
  // CREATE CATEGORY
  // ============================================================

  const handleCreate = async (event) => {

    event.preventDefault()

    setMessage('')
    setError(null)


    if (!categoryName.trim()) {

      setMessage(
        'Category name is required.'
      )

      return
    }


    try {

      await api.post(
        '/categories/',
        {
          category_name:
            categoryName.trim(),

          description:
            description.trim() || null,
        }
      )


      setCategoryName('')
      setDescription('')

      setShowForm(false)

      setMessage(
        'Category added successfully.'
      )


      await load()

    } catch (err) {

      setError(
        err.response?.data?.detail ||
        'Failed to add category.'
      )

    }

  }


  // ============================================================
  // DELETE CATEGORY
  // ============================================================

  const handleDelete = async (id) => {

    const confirmed = window.confirm(
      'Are you sure you want to delete this category?'
    )


    if (!confirmed) {
      return
    }


    setError(null)
    setMessage('')


    try {

      await api.delete(
        `/categories/${id}`
      )


      setMessage(
        'Category deleted successfully.'
      )


      setSelected(null)

      await load()

    } catch (err) {

      setError(
        err.response?.data?.detail ||
        'Failed to delete category.'
      )

    }

  }


  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {

    return (
      <Loading
        label="Loading categories..."
      />
    )

  }


  // ============================================================
  // GET PRODUCT COUNT
  // ============================================================

  const getCatProductCount = (
    categoryName
  ) => {

    return products.filter(
      (product) => {

        const productCategory =
          product.category_name ||
          product.category ||
          product.product_category


        return (
          productCategory &&
          String(productCategory)
            .trim()
            .toLowerCase() ===
          String(categoryName)
            .trim()
            .toLowerCase()
        )

      }
    ).length

  }


  // ============================================================
  // ENRICH CATEGORY DATA
  // ============================================================

  const enriched = categories.map(
    (category) => ({
      ...category,

      product_count:
        getCatProductCount(
          category.category_name
        ),
    })
  )


  // ============================================================
  // TABLE COLUMNS
  // ============================================================

  const columns = [

    {
      key: 'category_name',

      label: 'Name',

      render: (value) => (

        <span className="
          font-medium
          text-slate-800
          dark:text-slate-100
        ">

          {value || 'Unnamed Category'}

        </span>

      ),
    },


    {
      key: 'description',

      label: 'Description',

      render: (value) => (

        <span className="
          text-slate-600
          dark:text-slate-300
        ">

          {value || '—'}

        </span>

      ),
    },


    {
      key: 'product_count',

      label: 'Products',

      render: (value) => (

        <Badge
          tone={
            value > 0
              ? 'blue'
              : 'slate'
          }
        >

          {value}

        </Badge>

      ),
    },


    ...(canManageCategories
      ? [

          {
            key: 'actions',

            label: '',

            sortable: false,

            render: (_, row) => (

              <button
                type="button"

                onClick={(event) => {

                  event.stopPropagation()

                  handleDelete(row.id)

                }}

                className="
                  rounded-md
                  p-1.5
                  text-red-500
                  hover:bg-red-50
                  hover:text-red-700
                  dark:hover:bg-red-900/20
                  dark:hover:text-red-400
                  transition-colors
                "

                title="Delete category"
              >

                <Trash2 size={15} />

              </button>

            ),
          },

        ]

      : []),
  ]


  // ============================================================
  // PRODUCTS BELONGING TO SELECTED CATEGORY
  // ============================================================

  const getCategoryProducts = (
    categoryName
  ) => {

    return products.filter(
      (product) => {

        const productCategory =
          product.category_name ||
          product.category ||
          product.product_category


        return (
          productCategory &&
          String(productCategory)
            .trim()
            .toLowerCase() ===
          String(categoryName)
            .trim()
            .toLowerCase()
        )

      }
    )

  }


  // ============================================================
  // UI
  // ============================================================

  return (

    <div className="
      text-slate-800
      dark:text-slate-100
    ">


      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <PageHeader
        title="Categories"
        subtitle="Manage product categories."

        action={
          canManageCategories ? (

            <button
              type="button"

              onClick={() => {

                setShowForm(
                  (value) => !value
                )

                setMessage('')
                setError(null)

              }}

              className="
                btn-primary
                flex
                items-center
                gap-2
              "
            >

              <Plus size={16} />

              {showForm
                ? 'Cancel'
                : 'Add Category'}

            </button>

          ) : null
        }
      />


      {/* ======================================================
          ERROR MESSAGE
      ====================================================== */}

      {error && (

        <div className="mb-4">

          <ErrorBanner
            message={error}
          />

        </div>

      )}


      {/* ======================================================
          SUCCESS MESSAGE
      ====================================================== */}

      {message && (

        <div className="
          mb-4
          rounded-lg
          border
          border-slate-200
          bg-white
          px-4
          py-3
          text-sm
          text-slate-700

          dark:border-slate-700
          dark:bg-slate-800
          dark:text-slate-200
        ">

          {message}

        </div>

      )}


      {/* ======================================================
          SUMMARY CARDS
      ====================================================== */}

      <div className="
        grid
        grid-cols-1
        sm:grid-cols-3
        gap-3
        mb-6
      ">


        {/* TOTAL CATEGORIES */}

        <div className="
          card
          p-4
          text-center
          bg-white
          dark:bg-slate-800
          border
          border-slate-200
          dark:border-slate-700
        ">

          <p className="
            text-2xl
            font-bold
            text-slate-900
            dark:text-slate-100
          ">

            {categories.length}

          </p>


          <p className="
            mt-1
            text-[11px]
            font-medium
            uppercase
            tracking-wide
            text-slate-500
            dark:text-slate-400
          ">

            Total Categories

          </p>

        </div>


        {/* TOTAL PRODUCTS */}

        <div className="
          card
          p-4
          text-center
          bg-white
          dark:bg-slate-800
          border
          border-slate-200
          dark:border-slate-700
        ">

          <p className="
            text-2xl
            font-bold
            text-blue-600
            dark:text-blue-400
          ">

            {products.length}

          </p>


          <p className="
            mt-1
            text-[11px]
            font-medium
            uppercase
            tracking-wide
            text-slate-500
            dark:text-slate-400
          ">

            Total Products

          </p>

        </div>


        {/* ACTIVE CATEGORIES */}

        <div className="
          card
          p-4
          text-center
          bg-white
          dark:bg-slate-800
          border
          border-slate-200
          dark:border-slate-700
        ">

          <p className="
            text-2xl
            font-bold
            text-emerald-600
            dark:text-emerald-400
          ">

            {
              enriched.filter(
                (category) =>
                  category.product_count > 0
              ).length
            }

          </p>


          <p className="
            mt-1
            text-[11px]
            font-medium
            uppercase
            tracking-wide
            text-slate-500
            dark:text-slate-400
          ">

            Active Categories

          </p>

        </div>

      </div>


      {/* ======================================================
          ADD CATEGORY FORM
      ====================================================== */}

      {showForm &&
        canManageCategories && (

          <div className="
            card
            mb-6
            bg-white
            dark:bg-slate-800
            border
            border-slate-200
            dark:border-slate-700
          ">


            <h3 className="
              mb-5
              text-base
              font-semibold
              text-slate-900
              dark:text-slate-100
            ">

              Add Category

            </h3>


            <form
              onSubmit={handleCreate}
              className="space-y-5"
            >


              {/* CATEGORY NAME */}

              <div>

                <label className="
                  mb-1.5
                  block
                  text-sm
                  font-medium
                  text-slate-700
                  dark:text-slate-200
                ">

                  Category Name

                </label>


                <input
                  type="text"

                  value={categoryName}

                  onChange={(event) =>
                    setCategoryName(
                      event.target.value
                    )
                  }

                  placeholder="e.g. Kitchen Appliances"

                  className="
                    input
                    w-full
                    bg-white
                    text-slate-900
                    placeholder:text-slate-400

                    dark:bg-slate-900
                    dark:text-slate-100
                    dark:border-slate-600
                    dark:placeholder:text-slate-500

                    focus:outline-none
                    focus:ring-2
                    focus:ring-blue-500/30
                  "
                />

              </div>


              {/* DESCRIPTION */}

              <div>

                <label className="
                  mb-1.5
                  block
                  text-sm
                  font-medium
                  text-slate-700
                  dark:text-slate-200
                ">

                  Description

                </label>


                <textarea
                  value={description}

                  onChange={(event) =>
                    setDescription(
                      event.target.value
                    )
                  }

                  placeholder="Enter category description"

                  rows={3}

                  className="
                    input
                    w-full
                    resize-none
                    bg-white
                    text-slate-900
                    placeholder:text-slate-400

                    dark:bg-slate-900
                    dark:text-slate-100
                    dark:border-slate-600
                    dark:placeholder:text-slate-500

                    focus:outline-none
                    focus:ring-2
                    focus:ring-blue-500/30
                  "
                />

              </div>


              {/* BUTTONS */}

              <div className="
                flex
                justify-end
                gap-2
              ">

                <button
                  type="button"

                  onClick={() => {

                    setShowForm(false)

                    setCategoryName('')

                    setDescription('')

                  }}

                  className="
                    btn-secondary
                    dark:bg-slate-700
                    dark:text-slate-200
                    dark:border-slate-600
                    dark:hover:bg-slate-600
                  "
                >

                  Cancel

                </button>


                <button
                  type="submit"
                  className="btn-primary"
                >

                  Save Category

                </button>

              </div>

            </form>

          </div>

        )}


      {/* ======================================================
          CATEGORY TABLE
      ====================================================== */}

      <div className="
        card
        bg-white
        dark:bg-slate-800
        border
        border-slate-200
        dark:border-slate-700
        overflow-hidden
      ">


        {enriched.length === 0 ? (

          <EmptyState
            message="No categories yet."
          />

        ) : (

          <InteractiveTable

            data={enriched}

            columns={columns}

            searchableKeys={[
              'category_name',
              'description',
            ]}

            onRowClick={setSelected}

            emptyMessage="No categories found."

          />

        )}

      </div>


      {/* ======================================================
          CATEGORY DETAILS MODAL
      ====================================================== */}

      <DetailModal

        title={
          selected?.category_name || ''
        }

        subtitle="Category Details"

        onClose={() =>
          setSelected(null)
        }

      >

        {selected && (

          <div className="
            text-slate-800
            dark:text-slate-100
          ">


            {/* NAME */}

            <DetailModal.Row

              label="Name"

              value={
                selected.category_name
              }

              icon={Tags}

              tone="brand"

            />


            {/* DESCRIPTION */}

            <DetailModal.Row

              label="Description"

              value={
                selected.description ||
                'No description'
              }

            />


            {/* PRODUCTS */}

            <DetailModal.Row

              label="Products"

              value={
                selected.product_count
              }

            />


            {/* PRODUCTS SECTION */}

            <DetailModal.Section
              title="Products in this Category"
            >

              {getCategoryProducts(
                selected.category_name
              )
                .slice(0, 10)
                .map((product) => (

                  <div
                    key={product.id}
                    className="
                      flex
                      justify-between
                      items-center
                      gap-4
                      py-2
                      border-b
                      border-slate-100
                      dark:border-slate-700
                    "
                  >

                    <span className="
                      text-sm
                      text-slate-600
                      dark:text-slate-300
                    ">

                      {
                        product.name ||
                        product.product_name ||
                        'Unnamed Product'
                      }

                    </span>


                    <span className="
                      whitespace-nowrap
                      font-medium
                      text-slate-800
                      dark:text-slate-100
                    ">

                      ₹
                      {
                        product.price ??
                        product.selling_price ??
                        0
                      }

                    </span>

                  </div>

                ))}


              {getCategoryProducts(
                selected.category_name
              ).length === 0 && (

                <p className="
                  py-3
                  text-xs
                  text-slate-400
                  dark:text-slate-500
                ">

                  No products in this category.

                </p>

              )}

            </DetailModal.Section>

          </div>

        )}

      </DetailModal>

    </div>

  )

}