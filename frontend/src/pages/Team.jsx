import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import api from "../services/api";
import { PageHeader, ErrorBanner, Loading } from "../components/ui";

const ROLES = [
  {
    value: "store_manager",
    label: "Store Manager",
  },
  {
    value: "sales_executive",
    label: "Sales Executive",
  },
];

export default function Team() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role_name: "sales_executive",
  });

  const [submitting, setSubmitting] = useState(false);

  // ============================================================
  // FETCH TEAM MEMBERS
  // ============================================================

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.get("/users/");

        setUsers(
          Array.isArray(res.data)
            ? res.data
            : []
        );
      } catch (err) {
        console.error(
          "Fetch team members error:",
          err
        );

        setError(
          err.response?.data?.detail ||
            "Failed to fetch team members."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // ============================================================
  // INVITE MEMBER
  // ============================================================

  const handleInvite = async (e) => {
    e.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post(
        "/users/",
        form
      );

      setUsers((prev) => [
        ...prev,
        res.data,
      ]);

      setShowModal(false);

      setForm({
        full_name: "",
        email: "",
        password: "",
        role_name: "sales_executive",
      });
    } catch (err) {
      console.error(
        "Invite user error:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Failed to invite user."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // REMOVE MEMBER
  // ============================================================

  const handleRemove = async (userId) => {
    const confirmed = window.confirm(
      "Are you sure you want to remove this user?"
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      await api.delete(
        `/users/${userId}`
      );

      setUsers((prev) =>
        prev.filter(
          (user) => user.id !== userId
        )
      );
    } catch (err) {
      console.error(
        "Remove user error:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Failed to remove user."
      );
    }
  };

  // ============================================================
  // ROLE LABELS
  // ============================================================

  const ROLE_LABELS = {
    store_manager: "Store Manager",
    sales_executive: "Sales Executive",
    business_owner: "Business Owner",
    admin: "Admin",
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="text-slate-800 dark:text-slate-100">

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <PageHeader
        title="Team Management"
        description="Manage your employees and their roles."
        action={
          <button
            onClick={() => {
              setShowModal(true);
              setError(null);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Invite Member
          </button>
        }
      />

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* ======================================================
          LOADING
      ====================================================== */}

      {loading ? (
        <div className="flex justify-center p-8">
          <Loading />
        </div>
      ) : (
        <div className="card overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">

          <table className="w-full text-left text-sm">

            {/* ==================================================
                TABLE HEADER
            ================================================== */}

            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">

              <tr>

                <th className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                  Name
                </th>

                <th className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                  Email
                </th>

                <th className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                  Role
                </th>

                <th className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                  Actions
                </th>

              </tr>

            </thead>

            {/* ==================================================
                TABLE BODY
            ================================================== */}

            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">

              {users.map((u) => {

                const roleName =
                  u.role?.role_name;

                return (
                  <tr
                    key={u.id}
                    className="
                      hover:bg-slate-50
                      dark:hover:bg-slate-800/70
                      transition-colors
                    "
                  >

                    {/* NAME */}

                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-100">

                      {u.full_name || "—"}

                    </td>

                    {/* EMAIL */}

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">

                      {u.email || "—"}

                    </td>

                    {/* ROLE */}

                    <td className="py-3 px-4">

                      <span
                        className="
                          inline-flex
                          items-center
                          px-2.5
                          py-1
                          rounded-full
                          text-xs
                          font-medium
                          bg-brand-100
                          text-brand-800
                          dark:bg-brand-900/40
                          dark:text-brand-300
                        "
                      >
                        {ROLE_LABELS[roleName] ||
                          roleName ||
                          "—"}
                      </span>

                    </td>

                    {/* ACTIONS */}

                    <td className="py-3 px-4">

                      {roleName !==
                        "business_owner" && (

                        <button
                          onClick={() =>
                            handleRemove(u.id)
                          }
                          className="
                            text-red-500
                            hover:text-red-600
                            dark:text-red-400
                            dark:hover:text-red-300
                            hover:bg-red-50
                            dark:hover:bg-red-900/20
                            p-1.5
                            rounded
                            transition-colors
                          "
                          title="Remove user"
                        >
                          <Trash2 size={16} />
                        </button>

                      )}

                    </td>

                  </tr>
                );
              })}

              {/* ==================================================
                  EMPTY STATE
              ================================================== */}

              {users.length === 0 && (

                <tr>

                  <td
                    colSpan={4}
                    className="
                      py-10
                      text-center
                      text-slate-500
                      dark:text-slate-400
                    "
                  >
                    No team members found.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>
      )}

      {/* ========================================================
          INVITE MEMBER MODAL
      ======================================================== */}

      {showModal && (

        <div
          className="
            fixed
            inset-0
            bg-black/50
            dark:bg-black/70
            flex
            items-center
            justify-center
            z-50
            p-4
          "
        >

          <div
            className="
              bg-white
              dark:bg-slate-900
              border
              border-slate-200
              dark:border-slate-700
              rounded-xl
              shadow-xl
              w-full
              max-w-md
              overflow-hidden
              flex
              flex-col
            "
          >

            {/* ==================================================
                MODAL HEADER
            ================================================== */}

            <div
              className="
                px-6
                py-4
                border-b
                border-slate-200
                dark:border-slate-700
              "
            >

              <h3
                className="
                  text-lg
                  font-bold
                  text-slate-900
                  dark:text-slate-100
                "
              >
                Invite Team Member
              </h3>

              <p
                className="
                  text-sm
                  mt-1
                  text-slate-500
                  dark:text-slate-400
                "
              >
                Add a new employee to your business team.
              </p>

            </div>

            {/* ==================================================
                FORM
            ================================================== */}

            <form
              onSubmit={handleInvite}
              className="p-6 space-y-4"
            >

              {/* FULL NAME */}

              <div>

                <label
                  className="
                    block
                    text-sm
                    font-medium
                    mb-1
                    text-slate-700
                    dark:text-slate-300
                  "
                >
                  Full Name
                </label>

                <input
                  required
                  type="text"
                  className="
                    input
                    w-full
                    bg-white
                    dark:bg-slate-800
                    text-slate-900
                    dark:text-slate-100
                    border-slate-300
                    dark:border-slate-600
                    placeholder:text-slate-400
                    dark:placeholder:text-slate-500
                  "
                  value={form.full_name}
                  placeholder="Enter full name"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      full_name:
                        e.target.value,
                    })
                  }
                />

              </div>

              {/* EMAIL */}

              <div>

                <label
                  className="
                    block
                    text-sm
                    font-medium
                    mb-1
                    text-slate-700
                    dark:text-slate-300
                  "
                >
                  Email
                </label>

                <input
                  required
                  type="email"
                  className="
                    input
                    w-full
                    bg-white
                    dark:bg-slate-800
                    text-slate-900
                    dark:text-slate-100
                    border-slate-300
                    dark:border-slate-600
                    placeholder:text-slate-400
                    dark:placeholder:text-slate-500
                  "
                  value={form.email}
                  placeholder="Enter email address"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email:
                        e.target.value,
                    })
                  }
                />

              </div>

              {/* PASSWORD */}

              <div>

                <label
                  className="
                    block
                    text-sm
                    font-medium
                    mb-1
                    text-slate-700
                    dark:text-slate-300
                  "
                >
                  Password
                </label>

                <input
                  required
                  type="password"
                  className="
                    input
                    w-full
                    bg-white
                    dark:bg-slate-800
                    text-slate-900
                    dark:text-slate-100
                    border-slate-300
                    dark:border-slate-600
                    placeholder:text-slate-400
                    dark:placeholder:text-slate-500
                  "
                  value={form.password}
                  placeholder="Enter password"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      password:
                        e.target.value,
                    })
                  }
                />

              </div>

              {/* ROLE */}

              <div>

                <label
                  className="
                    block
                    text-sm
                    font-medium
                    mb-1
                    text-slate-700
                    dark:text-slate-300
                  "
                >
                  Role
                </label>

                <select
                  className="
                    input
                    w-full
                    bg-white
                    dark:bg-slate-800
                    text-slate-900
                    dark:text-slate-100
                    border-slate-300
                    dark:border-slate-600
                  "
                  value={form.role_name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role_name:
                        e.target.value,
                    })
                  }
                >

                  {ROLES.map((role) => (

                    <option
                      key={role.value}
                      value={role.value}
                      className="
                        bg-white
                        text-slate-900
                        dark:bg-slate-800
                        dark:text-slate-100
                      "
                    >
                      {role.label}
                    </option>

                  ))}

                </select>

              </div>

              {/* ==================================================
                  BUTTONS
              ================================================== */}

              <div
                className="
                  pt-4
                  flex
                  justify-end
                  gap-3
                "
              >

                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                  }}
                  className="
                    btn-secondary
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? "Inviting..."
                    : "Invite"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}