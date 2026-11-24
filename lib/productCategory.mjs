/** Conservative routing from reviewed Open Food Facts category tags.
 * Reference: Santé publique France FAQ Nutri-Score 2023 pp 16-20:
 * https://www.santepubliquefrance.fr/sites/default/files/rdd/document/FAQ-updatedAlgo-V11.pdf
 * Unknown or composite categories must not be inferred from an ingredient name.
 */
const groups={
 excluded:["infant-formulas","baby-foods","sports-nutrition","protein-powders","meal-replacements","foods-for-special-medical-purposes","alcoholic-beverages","beers","wines","spirits"],
 ambiguous:["drink-powders","instant-drinks","concentrates","dehydrated-foods","powdered-drinks","dried-soups"],
 composite:["chocolates","milk-chocolates","biscuits","cookies","cakes","crisps","chips","pizzas","pasta","pastas","sandwiches","soups","gazpacho","gazpachos","sauces","tomato-sauces","bolognese-sauces","mayonnaise","mayonnaises","condensed-milks","quarks","plant-based-cheeses","vegan-cheeses","chocolate-coated-almonds","chocolate-coated-nuts","chocolate-covered-almonds","chocolate-spreads","cocoa-spreads","nut-chocolate-spreads"],
 flavouredWater:["flavoured-waters","flavored-waters","sweetened-waters","coconut-waters","flavoured-water","flavored-water"],
 water:["natural-mineral-waters","mineral-waters","spring-waters","table-waters"],
 cheese:["cheese","cheeses","processed-cheeses","cheese-specialties","cheese-specialities"],
 redMeat:["red-meats","red-meat","beef","pork","lamb","mutton","veal","venison","ostrich-meat"],
 redMixed:["meatballs","sausages","meat-products","processed-meat","meat-preparations"],
 beverages:["beverages","drinks","fruit-juices","vegetable-juices","smoothies","nectars","sodas","soft-drinks","sweetened-beverages","energy-drinks","iced-teas","teas","coffees","milk","milks","cow-milks","whole-milks","skimmed-milks","semi-skimmed-milks","plant-based-milks","plant-based-beverages","chocolate-milks","flavoured-milks","flavored-milks","milk-drinks","milk-beverages","milk-based-drinks","drinkable-yogurts","drinking-yoghurts","coffee-creams","waters"],
 fats:["vegetable-oils","vegetable-oil","olive-oils","olive-oil","sunflower-oils","rapeseed-oils","cooking-oils","butters","butter","margarines","margarine","ghee","creams","cream","whipped-creams","cooking-creams","coconut-creams"],
 nutMixes:["peanut-butters","peanut-butter","nut-butters","almond-butters","cashew-butters","tahini","tahinis","mixed-nuts","roasted-nuts","salted-nuts","processed-nuts","nut-spreads","seed-spreads"],
 nuts:["nuts","seeds","almonds","cashews","walnuts","peanuts","hazelnuts","pistachios","pecans","sunflower-seeds","pumpkin-seeds","sesame-seeds","chia-seeds","flax-seeds","linseeds","coconuts","desiccated-coconut"],
 general:["snacks","bread","breads","cereals","breakfast-cereals","rice","yogurts","yoghurts","curds","vegetables","fruits","legumes","fish","poultry","chicken","eggs","desserts","confectioneries","frozen-foods"]
};
// Package scans use everyday category names while the barcode taxonomy often uses plurals.
// Match complete categories so "milk chocolate" and "chocolate milk" stay distinct.
const categoryAliases = new Map([
 ["chocolate", "chocolates"], ["milk-chocolate", "milk-chocolates"],
 ["dark-chocolate", "chocolates"], ["dark-chocolates", "chocolates"],
 ["white-chocolate", "chocolates"], ["white-chocolates", "chocolates"],
 ["chocolate-bar", "chocolates"], ["chocolate-bars", "chocolates"],
 ["chocolate-wafer", "biscuits"], ["chocolate-wafers", "biscuits"],
 ["chocolate-wafer-bar", "biscuits"], ["chocolate-wafer-bars", "biscuits"],
 ["confectionery", "confectioneries"], ["candy", "confectioneries"], ["candy-bar", "confectioneries"],
 ["snack", "snacks"], ["biscuit", "biscuits"], ["cookie", "cookies"],
 ["chocolate-milk", "chocolate-milks"], ["chocolate-drink-mix", "drink-powders"],
]);
function categoryTag(value) {
 const tag = String(value).toLowerCase().trim().replace(/^en:/, "").replace(/[_\s]+/g, "-");
 return categoryAliases.get(tag) || tag;
}
const matches=(tokens,names)=>names.some(n=>tokens.has(n));
const validPercent=v=>{if(v==null||v===""||typeof v==="boolean")return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=100?n:null;};
export function resolveCategory(product={}){
 if(!product||typeof product!=="object")return {};
 const name=String(product.product_name||"");
 const raw=[product.categories_tags,product.categories_tags_en,product.categories,product.product_category];
 const tags=new Set(raw.flatMap(v=>Array.isArray(v)?v:typeof v==="string"?v.split(","):[])
   .map(categoryTag).filter(Boolean));
 if(/\b(?:infant|baby|toddler|infant formula|follow-on formula|sports? nutrition|protein powder|medical food|meal replacement|alcoholic|beer|wine)\b/i.test(name)||matches(tags,groups.excluded))return {eligibility:"ineligible"};
 if(matches(tags,groups.ambiguous)||/\b(?:drink mix|instant drink|concentrate|powdered)\b/i.test(name))return {};
 const ok=category=>({eligibility:"eligible",category});
 // The food as sold determines its category; cheese or oil in a pizza does
 // not make a pizza cheese or oil. Order matters.
 if(matches(tags,groups.composite))return ok("general");
 if(matches(tags,groups.flavouredWater))return ok("beverage");
 if(matches(tags,groups.water))return ok("water");
 if(matches(tags,groups.cheese))return ok("cheese");
 const red=validPercent(product.red_meat_percent??product.red_meat_percentage);
 if(matches(tags,groups.redMixed))return red==null?{}:ok(red>=20?"red_meat":"general");
 if(matches(tags,groups.redMeat))return ok("red_meat");
 if(matches(tags,groups.beverages))return ok("beverage");
 if(matches(tags,groups.fats))return ok("fats_nuts_seeds");
 const nuts=validPercent(product.nuts_seeds_percentage??product.nut_percentage);
 if(matches(tags,groups.nutMixes))return nuts==null?{}:ok(nuts>50?"fats_nuts_seeds":"general");
 if(matches(tags,groups.nuts))return ok("fats_nuts_seeds");
 if(matches(tags,groups.general))return ok("general");
 return {};
}
