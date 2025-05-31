// Зарезервированные слова языка
const reservedWords = new Set([
  'dim', 'ass', 'integer', 'real', 'boolean',
  'if', 'then', 'else', 'for', 'to', 'do', 'while',
  'read', 'write', 'not', 'or', 'and', 'true', 'false',
  '=', ';', ',', '(', ')', '{', '}', '[', ']', '<', '>', '+', '-', '*', '/', ':'
]);

// Таблица идентификаторов (без повторов)
const identifierTable = new Map();
const reservedTable = new Map();  
const numberTable = new Map(); 
// Таблица всех лексем (с повторами)
const lexemeTable = [];

const reservedWordTable = []

// Основной анализатор
function analyzer(input) {
   // Разбиваем на токены: слова, числа, знаки, скобки и т.д.
  const tokens = input.match(/\w+|[=;(),{}\[\]<>:+\-*/]/g) || [];

  for (const token of tokens) {
    let index;
    if (reservedWords.has(token)) {
      if (!reservedTable.has(token)) {
        reservedTable.set(token, `1.${reservedTable.size + 1}`);
      }
      index = reservedTable.get(token);
    }
    // Добавляем в таблицу идентификаторов, если это валидный идентификатор
    else if (/^[a-zA-Z_]\w*$/.test(token)) {
      if (!identifierTable.has(token)) {
        identifierTable.set(token, `2.${identifierTable.size + 1}`);
      }
      index = identifierTable.get(token);
    } 
    else if (/^\d+(\.\d+)?$/.test(token)) {  // целые и вещественные числа
      if (!numberTable.has(token)) {
        numberTable.set(token, `3.${numberTable.size + 1}`);
      }
      index = numberTable.get(token);
    }
    else {
      continue
    }
     lexemeTable.push({ lexeme: token, ref: index });
  }
}

const inputText = `
{
  dim x, y integer;
  x ass 5;
  y ass 10;
  if x < y then {
    write(x);
  } else {
    write(y);
  }
}
`;

analyzer(inputText);
// console.log('Таблица зарезервированных слов:');
// console.table(Array.from(reservedTable.entries()).map(([lexeme, index]) => ({ index, lexeme })));

// console.log('Таблица идентификаторов:');
// console.table(Array.from(identifierTable.entries()).map(([lexeme, index]) => ({ index, lexeme })));

// console.log('Таблица чисел:');
// console.table(Array.from(numberTable.entries()).map(([lexeme, index]) => ({ index, lexeme })));

console.log('Таблица всех лексем с указанием индексов:');
console.table(lexemeTable);

// ----------------- Парсер -------------------

//Переменная для текущего индекса в массиве лексем
let pos = 0;

//Текущий токен
function current() {
  return lexemeTable[pos];
}

//Следующий токен
function next() {
  pos++;
  return lexemeTable[pos];
}

//Функции expect... проверяют, что следующий токен соответствует ожиданию
//------------------------------------------------------------------------------
function expectReserved(word) {
  const token = current();
  if (!token || !token.ref.startsWith('1.') || token.lexeme !== word) {
    throw new Error(`Ожидалось зарезервированное слово: '${word}'. Получено '${token?.lexeme}'`);
  }
  pos++;
}

function expectIdentifier() {
  const token = current();
  if (!token || !token.ref.startsWith('2.')) {
    throw new Error(`Ожидался идентификатор. Получено: '${token?.lexeme}'`);
  }
  pos++;
  return { type: 'Identifier', name: token.lexeme };
}

function expectNumber() {
  const token = current();
  if (!token || !token.ref.startsWith('3.')) {
    throw new Error(`Ожидалось число. Получено: '${token?.lexeme}'`);
  }
  pos++;
  return { type: 'Number', value: Number(token.lexeme) };
}

//------------------------------------------------------------------------------

function isReserved(word) {
  const token = current();
  return token && token.ref.startsWith('1.') && token.lexeme === word;
}

function isIdentifier() {
  const token = current();
  return token && token.ref.startsWith('2.');
}

function isNumber() {
  const token = current();
  return token && token.ref.startsWith('3.');
}

//Парсинг программы
// <программа>::= «{» {/ (<описание> | <оператор>) ; /} «}» 
function parseProgram() {
  expectReserved('{');
  const statements = [];
  while (!isReserved('}')) {
    if (isReserved('dim')) {
      statements.push(parseDescription());
    } else {
      statements.push(parseOperator());
    }
    // Теперь ';' обязательно после оператора, кроме последнего
    if (!isReserved('}')) {
      expectReserved(';');
    }
  }
  expectReserved('}');
  return { type: 'Program', body: statements };
}

// Описание переменных
// <описание>::= dim <идентификатор> {, <идентификатор> } <тип> 
function parseDescription() {
  expectReserved('dim');
  const identifiers = [expectIdentifier()];
  while (isReserved(',')) {
    pos++;
    identifiers.push(expectIdentifier());
  }
  const typeNode = parseType();
  return { type: 'VarDeclaration', identifiers, varType: typeNode };
}

// Типы данных
// <тип>::= integer | real | boolean 
function parseType() {
  if (isReserved('integer')) {
    pos++;
    return { type: 'Type', name: 'integer' };
  } else if (isReserved('real')) {
    pos++;
    return { type: 'Type', name: 'real' };
  } else if (isReserved('boolean')) {
    pos++;
    return { type: 'Type', name: 'boolean' };
  } else {
    throw new Error(`Ожидался тип переменной. Получено: '${current()?.lexeme}'`);
  }
}

// Операторы программы
// <оператор>::= <составной> | <присваивания> | <условный> |  <фиксированного_цикла> | <условного_цикла> | <ввода> |  <вывода></вывода>
function parseOperator() {
  if (isReserved('{')) {
    return parseCompoundOperator();
  }
  //Если идентификатор — это присваивание
  if (isIdentifier()) {
    return parseAssignment();
  }
  if (isReserved('if')) {
    return parseIf();
  }
  if (isReserved('for')) {
    return parseFor();
  }
  if (isReserved('while')) {
    return parseWhile();
  }
  if (isReserved('read')) {
    return parseRead();
  }
  if (isReserved('write')) {
    return parseWrite();
  }
  throw new Error(`Неизвестный оператор: '${current()?.lexeme}'`);
}

//Составной оператор
//<составной>::= <оператор> { ( : | перевод строки) <оператор> } 
function parseCompoundOperator() {
  expectReserved('{');
  const operators = [];
  while (!isReserved('}')) {
    operators.push(parseOperator());
    expectReserved(';'); // обязательный разделитель операторов внутри блока
    // Ожидаем разделитель, например ';' или перевод строки (в зависимости от лексера)
    if (isReserved(';')) pos++;
  }
  expectReserved('}');
  return { type: 'Compound', body: operators };
}

// Присваивание 
// <присваивания>::= <идентификатор> ass <выражение> 
function parseAssignment() {
  const id = expectIdentifier();
  expectReserved('ass');
  const expr = parseExpression();
  return { type: 'Assignment', id, expr };
}

// Условный оператор
// <условный>::= if <выражение> then <оператор> [ else <оператор>] 
function parseIf() {
  expectReserved('if');
  const condition = parseExpression();
  expectReserved('then');

  if (!isReserved('{')) {
    throw new Error(`Ожидалось '{' после 'then'`);
  }
  const thenBranch = parseCompoundOperator();

  let elseBranch = null;
  if (isReserved('else')) {
    pos++;
    if (!isReserved('{')) {
      throw new Error(`Ожидалось '{' после 'else'`);
    }
    elseBranch = parseCompoundOperator();
  }
  return { type: 'If', condition, thenBranch, elseBranch };
}

// Цикл for
// <фиксированного_цикла>::= for <присваивания>  to <выражение> do <оператор> 
function parseFor() {
  expectReserved('for');
  const assign = parseAssignment();
  expectReserved('to');
  const limit = parseExpression();
  expectReserved('do');
  const body = parseCompoundOperator();
  return { type: 'For', assignment: assign, limit, body };
}

// Цикл While
// <условного_цикла>::= while <выражение>  do <оператор> 
function parseWhile() {
  expectReserved('while');
  const cond = parseExpression();
  expectReserved('do');
  const body = parseOperator();
  return { type: 'While', condition: cond, body };
}

//Оператор ввода
// <ввода>::= read (<идентификатор> {, <идентификатор> }) 
function parseRead() {
  expectReserved('read');
  expectReserved('(');
  const ids = [expectIdentifier()];
  while (isReserved(',')) {
    pos++;
    ids.push(expectIdentifier());
  }
  expectReserved(')');
  return { type: 'Read', identifiers: ids };
}

// Оператор вывода
// <вывода>::= write (<выражение> {, <выражение> }) 
function parseWrite() {
  expectReserved('write');
  expectReserved('(');
  const exprs = [parseExpression()];
  while (isReserved(',')) {
    pos++;
    exprs.push(parseExpression());
  }
  expectReserved(')');
  return { type: 'Write', expressions: exprs };
}

// Парсинг выражений из нормализованной грамматики
// <выражение> ::= <операнд> { <операции_группы_отношения> <операнд> } 
// Пример: (a < b)
function parseExpression() {
  let left = parseOperand();
  while (current() && ['<', '>', '=', '<=', '>='].includes(current().lexeme)) {
    const op = current().lexeme;
    pos++;
    const right = parseOperand();
    left = { type: 'BinaryOp', operator: op, left, right };
  }
  return left;
}

// <операнд> ::= <слагаемое> <AO>
// AO ::= A AO_fact_A | ε
function parseOperand() {
  const left = parseTerm();
  const ao = parseAO();
  //Если нашли операцию сложения / вычитания
  if (ao) {
    return { type: 'BinaryOp', operator: ao.operator, left, right: ao.right };
  }
  //Если нет, то просто слагаемое
  return left;
}

// AO ::= A AO_fact_A | ε
// AO — это цепочка операций сложения/вычитания/or
function parseAO() {
  if (current() && ['+', '-', 'or'].includes(current().lexeme)) {
    const operator = parseA();
    const right = parseAO_fact_A();
    return { operator, right };
  }
  return null;
}

// A ::= '+' | '-' | 'or'
//parseA() просто считывает и возвращает оператор:
function parseA() {
  const token = current();
  if (token && ['+', '-', 'or'].includes(token.lexeme)) {
    pos++;
    return token.lexeme;
  }
  throw new Error(`Ожидался оператор сложения, получено '${token?.lexeme}'`);
}

// AO_fact_A ::= <слагаемое> AO | <слагаемое>
// парсит слагаемое и возможно продолжает цепочку AO
function parseAO_fact_A() {
  const term = parseTerm();
  const ao = parseAO();
  if (ao) {
    return {
      type: 'BinaryOp',
      operator: ao.operator,
      left: term,
      right: ao.right
    };
  }
  return term;
}

// <слагаемое> ::= <множитель> <MO>
// MO ::= M MO_fact_M | ε
function parseTerm() {
  const left = parseFactor();
  const mo = parseMO();
  if (mo) {
    return { type: 'BinaryOp', operator: mo.operator, left, right: mo.right };
  }
  return left;
}

// MO ::= M MO_fact_M | ε
function parseMO() {
  if (current() && ['*', '/', 'and'].includes(current().lexeme)) {
    const operator = parseM();
    const right = parseMO_fact_M();
    return { operator, right };
  }
  return null;
}

// M ::= '*' | '/' | 'and'
function parseM() {
  const token = current();
  if (token && ['*', '/', 'and'].includes(token.lexeme)) {
    pos++;
    return token.lexeme;
  }
  throw new Error(`Ожидался оператор умножения, получено '${token?.lexeme}'`);
}

// MO_fact_M ::= <множитель> MO | <множитель>
function parseMO_fact_M() {
  const factor = parseFactor();
  const mo = parseMO();
  if (mo) {
    return {
      type: 'BinaryOp',
      operator: mo.operator,
      left: factor,
      right: mo.right
    };
  }
  return factor;
}

// <множитель>::= <идентификатор> | <число> | <логическая_константа> | <унарная_операция> <множитель> | (<выражение>)
function parseFactor() {
  const token = current();

  if (!token) throw new Error('Неожиданное завершение ввода');

  // Логическая константа
  if (token.ref.startsWith('1.') && (token.lexeme === 'true' || token.lexeme === 'false')) {
    pos++;
    return { type: 'Boolean', value: token.lexeme === 'true' };
  }

  // Унарная операция
  if (token.ref.startsWith('1.') && token.lexeme === 'not') {
    pos++;
    const operand = parseFactor();
    return { type: 'UnaryOp', operator: 'not', operand };
  }

  // Скобки
  if (token.ref.startsWith('1.') && token.lexeme === '(') {
    pos++;
    const expr = parseExpression();
    expectReserved(')');
    return expr;
  }

  // Идентификатор
  if (token.ref.startsWith('2.')) {
    pos++;
    return { type: 'Identifier', name: token.lexeme };
  }

  // Число
  if (token.ref.startsWith('3.')) {
    pos++;
    return { type: 'Number', value: Number(token.lexeme) };
  }

  throw new Error(`Неопознанный токен '${token.lexeme}'`);
}

// Основная точка входа
function parse(input) {
  pos = 0;
  lexemeTable.length = 0;
  reservedTable.clear();
  identifierTable.clear();
  numberTable.clear();
  analyzer(input);
  return parseProgram();
}

const ast = parse(inputText);
console.log('AST:');
console.dir(ast, { depth: null });