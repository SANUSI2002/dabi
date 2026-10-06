import React from 'react';
import './care.css';
export const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const blankMeal = () => ({day:'Monday',time:'Breakfast',food:'',portion:'',alternative:'',preparation:''});
export function MealPlanTable({meals, onChange}) {
  const editable=!!onChange;
  const change=(index,key,value)=>onChange(meals.map((row,i)=>i===index?{...row,[key]:value}:row));
  return <div className="care-table-wrap"><table className="care-meal-table"><caption>Meal schedule · nutrition plan, not a medication prescription</caption><thead><tr>{['Day','Meal / time','Food items','Portion','Alternative','Preparation',...(editable?['Action']:[])].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{meals.map((meal,index)=><tr key={index}>{['day','time','food','portion','alternative','preparation'].map(key=><td key={key}>{editable ? key==='day'?<select aria-label={`Day for meal ${index+1}`} value={meal.day} onChange={e=>change(index,key,e.target.value)}>{DAYS.map(d=><option key={d}>{d}</option>)}</select>:<textarea aria-label={`${key} for meal ${index+1}`} value={meal[key]} maxLength={key==='preparation'?1000:key==='food'||key==='alternative'?500:key==='time'?50:200} onChange={e=>change(index,key,e.target.value)} /> : meal[key] || '—'}</td>)}{editable&&<td><button type="button" onClick={()=>onChange(meals.filter((_,i)=>i!==index))}>Remove</button></td>}</tr>)}</tbody></table>{!meals.length&&<p>No meals added.</p>}{editable&&<button type="button" disabled={meals.length>=70} onClick={()=>onChange([...meals,blankMeal()])}>Add meal</button>}</div>;
}
