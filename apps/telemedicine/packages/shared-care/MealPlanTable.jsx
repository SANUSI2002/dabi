import React from 'react';
import './care.css';
export const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const blankMeal = () => ({day:'Monday',time:'Breakfast',food:'',portion:'',alternative:'',preparation:''});
const LIMITS = { preparation: 1000, food: 500, alternative: 500, time: 50, portion: 200 };
const LABELS = { day: 'Day', time: 'Meal / time', food: 'Food items', portion: 'Portion', alternative: 'Alternative', preparation: 'Preparation' };

/**
 * A nutrition meal schedule. With `onChange` it is the professional's editable table; without it,
 * patients see the plan grouped by day so it reads naturally on a phone.
 */
export function MealPlanTable({meals, onChange}) {
  const editable = !!onChange;
  if (!editable) return <MealPlanByDay meals={meals} />;
  const change = (index, key, value) => onChange(meals.map((row, i) => i === index ? {...row, [key]: value} : row));
  return <div className="care-meal-editor">
    <div className="care-table-wrap"><table className="care-meal-table">
      <caption>Meal schedule · a nutrition plan, not a medication prescription</caption>
      <thead><tr>{[...Object.values(LABELS), 'Action'].map((h) => <th key={h} scope="col">{h === 'Action' ? <span className="sx-sr-only">Action</span> : h}</th>)}</tr></thead>
      <tbody>{meals.map((meal, index) => <tr key={index}>{Object.keys(LABELS).map((key) => <td key={key}>{key === 'day'
        ? <select className="sx-select" aria-label={`Day for meal ${index + 1}`} value={meal.day} onChange={(e) => change(index, key, e.target.value)}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select>
        : <textarea className="sx-textarea" aria-label={`${LABELS[key]} for meal ${index + 1}`} value={meal[key]} maxLength={LIMITS[key]} onChange={(e) => change(index, key, e.target.value)} />}</td>)}
        <td><button type="button" className="sx-btn sx-btn-ghost sx-btn-sm" onClick={() => onChange(meals.filter((_, i) => i !== index))}>Remove<span className="sx-sr-only"> meal {index + 1}</span></button></td></tr>)}</tbody>
    </table></div>
    {!meals.length && <p className="care-muted">No meals added yet.</p>}
    <button type="button" className="sx-btn sx-btn-secondary" disabled={meals.length >= 70} onClick={() => onChange([...meals, blankMeal()])}>Add meal</button>
  </div>;
}

function MealPlanByDay({ meals }) {
  if (!meals?.length) return <p className="care-muted">No meals in this plan.</p>;
  const days = DAYS.map((day) => [day, meals.filter((m) => m.day === day)]).filter(([, items]) => items.length);
  // Never drop a meal: anything not filed under a weekday is still shown.
  const unfiled = meals.filter((m) => !DAYS.includes(m.day));
  if (unfiled.length) days.push(['Other meals', unfiled]);
  return <div className="care-days">
    <p className="care-muted">A nutrition plan, not a medication prescription.</p>
    {days.map(([day, items]) => <section className="care-day" key={day} aria-label={day}>
      <h4>{day}</h4>
      <ul>{items.map((meal, i) => <li key={i} className="care-meal">
        <span className="care-meal-time">{meal.time}</span>
        <div className="care-meal-body">
          <strong>{meal.food}</strong>
          {meal.portion && <span className="care-meal-portion">{meal.portion}</span>}
          {meal.alternative && <p><span>Alternative:</span> {meal.alternative}</p>}
          {meal.preparation && <p><span>How to prepare:</span> {meal.preparation}</p>}
        </div>
      </li>)}</ul>
    </section>)}
  </div>;
}
