export default function NutritionGrade({ score }) {
  const labels = {
    energy: 'Energy', sugars: 'Total sugars', saturatedFat: 'Saturated fat',
    salt: 'Salt', sweeteners: 'Sweeteners', fibre: 'Fibre', protein: 'Eligible protein',
    eligiblePlants: 'Eligible fruit, vegetables and legumes',
    energyKj: 'Energy', sugarsG: 'Total sugars', saturatedFatG: 'Saturated fat',
    saltG: 'Salt or sodium', fibreG: 'Fibre', proteinG: 'Protein', totalFatG: 'Total fat',
    eligiblePlantPercent: 'Fruit, vegetable and legume percentage',
    hasSpecifiedSweeteners: 'Sweetener information', eligibility: 'Supported product category',
  };
  const partial = score?.partialRating;
  const status = score?.status;
  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-700">
      <summary className="cursor-pointer font-semibold">
        {partial ? `Why partial grade ${partial.grade}?` : score?.grade ? `Why grade ${score.grade}?` : 'Why is a grade unavailable?'}
      </summary>
      <p className="mt-2">Calculated using updated Nutri-Score rules. Lower raw scores indicate a more favourable nutritional profile.</p>
      <p className="mt-2">
        {partial ? `Veronica counted ${partial.points} points from the available information. The full grade could be ${partial.bestGrade}–${partial.worstGrade} once the missing values are known.` :
          status === 'not_applicable' ? 'This product is outside the supported scoring scope.' :
          !score ? 'This older analysis has no calculated grade. Scan again.' :
          status === 'grade_only' ? 'The exact score is incomplete, but missing values cannot change the grade.' :
          status === 'scored' ? 'All values required for this calculation are available. Check extracted values against the package.' :
          'More reliable label information or a supported product category is needed.'}
      </p>
      {partial && <p className="mt-2">Counted: {Object.entries(partial.contributions).map(([key, points]) =>
        `${labels[key] || key} (${points > 0 ? '+' : ''}${points})`).join(', ')}</p>}
      {score?.rawScore != null && <p className="mt-2">Raw score: {score.rawScore}</p>}
      {status === 'grade_only' && <p className="mt-2">Possible raw score: {score.scoreRange.min}–{score.scoreRange.max}</p>}
      {score?.missingFields?.length > 0 && <p className="mt-2">Missing: {score.missingFields.map(key => labels[key] || key).join(', ')}</p>}
      {score?.issues?.map((issue, i) => <p className="mt-1" key={i}>{issue}</p>)}
      {!partial && score?.breakdown?.negative && (
        <table className="mt-3 w-full text-left">
          <thead><tr><th>Component</th><th>Points</th></tr></thead>
          <tbody>
            {Object.entries(score.breakdown.negative).map(([key,value]) => <tr key={key}><td>{labels[key] || key}</td><td>{value == null ? 'Unknown' : `+${value}`}</td></tr>)}
            {Object.entries(score.breakdown.positive).map(([key,value]) => <tr key={key}><td>{labels[key] || key}</td><td>{value == null ? 'Unknown' : `−${value}`}</td></tr>)}
          </tbody>
        </table>
      )}
      {score?.breakdown?.proteinEligible === false && <p className="mt-2">Protein points do not apply under this category’s scoring rules.</p>}
      <p className="mt-2">Nutrition quality is separate from allergies and personal dietary needs.</p>
    </details>
  );
}
