// E - Expression — выражение
// O - Operand — операнд 
// T - Term — слагаемое 
// M - Factor — множитель

// ID — идентификатор
// NUM — число (целое или действительное)
// BOOL — логическая константа (true/false)
// UN — унарная операция (-, not)
// LP и RP — скобки ( и )
// MUL — операции группы умножения (*, / и т.п.)
// A — операции группы сложения (+, - и т.п.)
// RO — операции группы отношения (<, >, == и т.п.)

const grammar = {
  E: [['O', 'ROE']],                      // <выражение>::= <операнд>{<операции_группы_отношения> <операнд>} 
  ROE: [['RO', 'O', 'ROE'], ['ε']],       //{<операции_группы_отношения> <операнд>} 
  O: [['T', 'AO']],                       //<операнд>::= <слагаемое> {<операции_группы_сложения> <слагаемое>} 
  AO: [['A', 'T', 'AO'], ['ε']],          //{<операции_группы_сложения> <слагаемое>} 
  T: [['M', 'MT']],                       // <слагаемое>::= <множитель> {<операции_группы_умножения> <множитель>}
  MT: [['MUL', 'M', 'MT'], ['ε']],        // {<операции_группы_умножения> <множитель>}
  M: [['ID'], ['NUM'], ['BOOL'], ['UN', 'M'], ['LP', 'E', 'RP']], // <множитель>::= <идентификатор> | <число> | <логическая_константа> | <унарная_операция>  <множитель> | (<выражение>) 
};

// ---------------------------

// 1. Удаление ε-правил
function removeEpsilonRules(g) {
  // Шаг 1: найти nullable нетерминалы
  let nullable = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [nt, prods] of Object.entries(g)) {
      if (nullable.has(nt)) continue;
      for (const prod of prods) {
        if (prod.length === 1 && prod[0] === 'ε') {
          nullable.add(nt);
          changed = true;
          break;
        }
        if (prod.every(sym => nullable.has(sym))) {
          nullable.add(nt);
          changed = true;
          break;
        }
      }
    }
  }

  // Шаг 2: построить новую грамматику без ε-продукций
  const newGrammar = {};
  for (const [nt, prods] of Object.entries(g)) {
    const newProds = new Set();
    for (const prod of prods) {
      if (prod.length === 1 && prod[0] === 'ε') {
        // пропускаем ε-продукцию
        continue;
      }
      // Генерируем все варианты с удалением nullable символов
      const variants = [[]];
      for (const sym of prod) {
        if (nullable.has(sym)) {
          // символ nullable, можно включить или нет
          const newVariants = [];
          for (const v of variants) {
            // не включаем sym
            newVariants.push([...v]);
            // включаем sym
            newVariants.push([...v, sym]);
          }
          variants.splice(0, variants.length, ...newVariants);
        } else {
          // символ не nullable, просто добавляем к каждой варианту
          for (const v of variants) {
            v.push(sym);
          }
        }
      }
      // Удаляем пустые варианты (они заменяют ε)
      for (const v of variants) {
        if (v.length === 0) {
          // если nt == стартовый символ, можно оставить ε, иначе нет
          // здесь просто пропускаем пустой вариант (удаление ε)
          continue;
        }
        newProds.add(v.join(' '));
      }
    }
    newGrammar[nt] = [...newProds].map(str => str.split(' '));
    if (newGrammar[nt].length === 0) {
      // Если для нетерминала не осталось продукций, то делаем его "ε" для безопасности
      newGrammar[nt] = [['ε']];
    }
  }
  return newGrammar;
}

// 2. Удаление цепных правил
function removeChainRules(g) {
  // Найдем цепные переходы nt -> nt'
  // Построим для каждого нетерминала множество достижимых по цепным правилам нетерминалов
  const nts = Object.keys(g);
  const chainSets = {};
  for (const nt of nts) {
    chainSets[nt] = new Set([nt]);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const nt of nts) {
      for (const prod of g[nt]) {
        if (prod.length === 1 && nts.includes(prod[0])) {
          // цепное правило nt -> prod[0]
          for (const x of chainSets[prod[0]]) {
            if (!chainSets[nt].has(x)) {
              chainSets[nt].add(x);
              changed = true;
            }
          }
        }
      }
    }
  }

  // Построим новую грамматику
  const newGrammar = {};
  for (const nt of nts) {
    const prodsSet = new Set();
    for (const nt2 of chainSets[nt]) {
      for (const prod of g[nt2]) {
        // исключаем цепные правила
        if (prod.length === 1 && nts.includes(prod[0])) continue;
        prodsSet.add(prod.join(' '));
      }
    }
    newGrammar[nt] = [...prodsSet].map(s => s.split(' '));
  }
  return newGrammar;
}

// 3. Устранение левой рекурсии (прямая)
function removeLeftRecursion(g) {
  const nts = Object.keys(g);
  const newGrammar = {};

  for (const nt of nts) {
    const prods = g[nt];
    const recursive = [];
    const nonRecursive = [];

    for (const prod of prods) {
      if (prod[0] === nt) {
        recursive.push(prod.slice(1));
      } else {
        nonRecursive.push(prod);
      }
    }

    if (recursive.length === 0) {
      newGrammar[nt] = prods;
    } else {
      // создаём новый нетерминал
      const newNt = nt + "'";
      // non-recursive productions с добавлением newNt
      newGrammar[nt] = nonRecursive.map(p => [...p, newNt]);
      // recursive productions с добавлением newNt в конце
      newGrammar[newNt] = recursive.map(p => [...p, newNt]);
      newGrammar[newNt].push(['ε']);
    }
  }
  return newGrammar;
}

// 4. Левая факторизация (базовый вариант)
function leftFactorGrammar(g) {
  const nts = Object.keys(g);
  const newGrammar = JSON.parse(JSON.stringify(g));

  for (const nt of nts) {
    const prods = newGrammar[nt];
    if (prods.length <= 1) continue;

    // Группируем по первому символу
    const groups = {};
    for (const prod of prods) {
      const firstSym = prod[0] || '';
      if (!groups[firstSym]) groups[firstSym] = [];
      groups[firstSym].push(prod);
    }

    for (const [firstSym, group] of Object.entries(groups)) {
      if (group.length > 1 && firstSym !== 'ε') {
        // Нужно факторизовать
        const newNt = nt + "_fact_" + firstSym.replace(/[^a-zA-Z0-9]/g, '');
        // заменяем эти продукции у nt
        newGrammar[nt] = newGrammar[nt].filter(p => !group.includes(p));
        newGrammar[nt].push([firstSym, newNt]);
        // создаём новые продукции для newNt без первого символа
        newGrammar[newNt] = group.map(p => p.slice(1).length ? p.slice(1) : ['ε']);
      }
    }
  }

  return newGrammar;
}

// Функция для красивого вывода грамматики
function printGrammar(g) {
  for (const [nt, prods] of Object.entries(g)) {
    const rhs = prods.map(prod => prod.join(' ')).join(' | ');
    console.log(`${nt} ::= ${rhs}`);
  }
}

// --- Применяем шаги ---

let g1 = removeEpsilonRules(grammar);
let g2 = removeChainRules(g1);
let g3 = removeLeftRecursion(g2);
let g4 = leftFactorGrammar(g3);

printGrammar(g4);

//Результат
// E ::= O ROE |                <выражение> ::= <операнд> {<операции_группы_отношения> <операнд>}
//        T AO |                               <слагаемое> {<операции_группы_сложения> <слагаемое>}
//        M MT |                               <множитель> {<операции_группы_умножения> <множитель>}
//          ID |                               <идентификатор>
//         NUM |                               <число>
//        BOOL |                               <логическая_константа>
//        UN M |                               <унарная_операция> <множитель>
//        LP E RP                              ( <выражение> )

// ROE ::= RO ROE_fact_RO       {<операции_группы_отношения> <операнд>}   

// O ::= T AO |                 <операнд> ::= <слагаемое> {<операции_группы_сложения> <слагаемое>}
//       M MT |                               <множитель> {<операции_группы_умножения> <множитель>}
//         ID |                               <идентификатор>
//        NUM |                               <число>
//       BOOL |                               <логическая_константа>
//       UN M |                               <унарная_операция> <множитель>
//       LP E RP                              ( <выражение> )

// AO ::= A AO_fact_A            {<операции_группы_сложения> <слагаемое>}

// T ::= M MT |                  <слагаемое> ::= <множитель> {<операции_группы_умножения> <множитель>}
//         ID | 
//        NUM | 
//       BOOL | 
//       UN M | 
//       LP E RP           

// MT ::= MUL MT_fact_MUL        {<операции_группы_умножения> <множитель>}      

// M ::= ID |                    <множитель> ::= <идентификатор>
//      NUM |                                    <число>
//     BOOL |                                    <логическая_константа>
//     UN M |                                    <унарная_операция> <множитель>
//     LP E RP                                   ( <выражение> )

// ROE_fact_RO ::= O | O ROE          

// AO_fact_A ::= T | T AO           

// MT_fact_MUL ::= M | M MT                                       