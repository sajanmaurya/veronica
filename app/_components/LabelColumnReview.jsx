"use client";

import { useState } from "react";
import { analyzeLabelColumns, labelFields, printedBasis } from "@/lib/labelColumns.mjs";

function PanelPhoto({ src, box }) {
  const [dimensions, setDimensions] = useState(null);
  const [fullPhoto, setFullPhoto] = useState(false);
  if (!src) return null;

  const validBox =
    Array.isArray(box) &&
    box.length === 4 &&
    box.every((n) => Number.isFinite(n) && n >= 0 && n <= 1000) &&
    box[2] > box[0] &&
    box[3] > box[1];
  const crop = validBox && dimensions && !fullPhoto;
  const style = crop
    ? {
        position: "absolute",
        top: 0,
        left: 0,
        width: 100000 / (box[2] - box[0]) + "%",
        maxWidth: "none",
        transform: `translate(-${box[0] / 10}%, -${box[1] / 10}%)`,
      }
    : { width: "100%" };
  return (
    <div>
      <div
        className="relative overflow-hidden rounded-lg"
        style={crop ? { aspectRatio: (dimensions * (box[2] - box[0])) / (box[3] - box[1]) } : {}}
      >
        <img
          src={src}
          alt="Uploaded nutrition label"
          style={style}
          onLoad={(event) =>
            setDimensions(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)
          }
        />
      </div>
      {validBox && (
        <button type="button" className="mt-1 underline" onClick={() => setFullPhoto(!fullPhoto)}>
          {fullPhoto ? "Show nutrition panel" : "Show full photo"}
        </button>
      )}
    </div>
  );
}

const inputStyle = "w-full rounded border border-slate-300 bg-white p-2 text-sm";
export default function LabelColumnReview({ data, photo, onReview }) {
  const panel = data.nutrition_panel;
  const columns = panel.columns || [];
  const [index, setIndex] = useState("");
  const [column, setColumn] = useState({});
  const [basis, setBasis] = useState("");
  const [serving, setServing] = useState(panel.serving_size || "");
  const [error, setError] = useState("");
  const changeColumn = (value) => {
    setIndex(value);
    setColumn(columns[value] || {});
    setBasis("");
    setError("");
  };
  function confirm(event) {
    event.preventDefault();
    if (!basis || index === "") return;
    const review = {
      column,
      column_index: index === "manual" ? null : Number(index),
      basis,
      serving_size: serving.trim() || null,
    };
    const result = analyzeLabelColumns(data.nutrition_scan_product || data, panel, review);
    if (result.nutrition_validation.status === "needs_verification") {
      setError(result.nutrition_validation.message);
      return;
    }
    setError("");
    onReview({
      ...data,
      ...result,
      data_sources: { ...data.data_sources, nutrition: result.nutrition_source },
      verification_required:
        !result.nutrition_score.grade ||
        data.ingredients_source === "unavailable" ||
        !data.pack_size_verified,
    });
  }
  return (
    <details
      open={data.nutrition_validation?.status === "needs_verification"}
      className="mt-3 rounded-xl border border-amber-200 p-3 text-sm"
    >
      <summary className="cursor-pointer font-semibold">Check the printed nutrition column</summary>
      <form className="mt-3 grid gap-3" onSubmit={confirm}>
        <PanelPhoto src={photo} box={panel.panel_box} />
        <label>
          Column to check
          <select
            required
            className={inputStyle}
            value={index}
            onChange={(e) => changeColumn(e.target.value)}
          >
            <option value="">Choose a column</option>
            {columns.map((c, i) => (
              <option key={i} value={i} disabled={["percentage", "per_container"].includes(printedBasis(c.heading))}>
                {c.heading || "Unreadable heading"} (column {i + 1})
              </option>
            ))}
            <option value="manual">Enter a column from the photo</option>
          </select>
        </label>
        {index !== "" && (
          <>
            <label>
              Printed basis
              <select
                required
                className={inputStyle}
                value={basis}
                onChange={(e) => setBasis(e.target.value)}
              >
                <option value="">Choose the basis on the label</option>
                <option value="per_100g">Per 100 g</option>
                <option value="per_100ml">Per 100 ml</option>
                <option value="per_serving">Per serving</option>
              </select>
            </label>
            {basis === "per_serving" && (
              <label>
                Printed serving size, including g or ml
                <input
                  required
                  className={inputStyle}
                  value={serving}
                  onChange={(e) => setServing(e.target.value)}
                />
              </label>
            )}
            <p>Copy values with their units from this one column. Leave unreadable values blank.</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(labelFields).map(([key, [name, unit]]) => (
                <label key={key}>
                  {name} ({unit})
                  <input
                    className={inputStyle}
                    value={column[key] ?? ""}
                    onChange={(e) => setColumn({ ...column, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <button type="submit" className="rounded-lg bg-emerald-800 p-2 font-semibold text-white">
              Confirm values and recalculate
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="text-amber-900">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}
