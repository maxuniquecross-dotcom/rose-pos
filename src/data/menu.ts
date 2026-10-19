import type { GroupId, MenuItem, Modifier } from '../types'

export const GROUPS: { id: GroupId; title: string; accent: string }[] = [
  { id: 'wine', title: 'Вино', accent: '#d46a78' },
  { id: 'pizza', title: 'Пицца', accent: '#e08a4f' },
  { id: 'snacks', title: 'Закуски', accent: '#d2a15a' },
  { id: 'salads', title: 'Салаты', accent: '#7dae6e' },
  { id: 'raw', title: 'Raw bar', accent: '#e07a8a' },
  { id: 'mains', title: 'Горячее', accent: '#c9845a' },
  { id: 'soups', title: 'Супы', accent: '#d08a4a' },
  { id: 'sides', title: 'Гарниры', accent: '#c4b48a' },
  { id: 'desserts', title: 'Десерты', accent: '#d98cb0' },
  { id: 'bar', title: 'Бар', accent: '#e0b15c' },
  { id: 'coffee', title: 'Кофе', accent: '#c4a48a' },
  { id: 'tea', title: 'Чай', accent: '#8fbf8a' },
  { id: 'drinks', title: 'Напитки', accent: '#7eb0d4' },
]

export const SECTION_NOTES: Record<string, string> = {
  'Разливное пиво': 'Крафтовый ассортимент уточняйте у бара',
  Кофе: 'Альтернативное молоко +1,50',
}

const ALT_MILK: Modifier[] = [{ id: 'alt-milk', name: 'альт. молоко', price: 1.5 }]

function slug(value: string) {
  return value
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replaceAll('і', 'и')
    .replace(/[^a-z0-9а-я]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

function buildMenu() {
  const items: MenuItem[] = []

  const add = (
    group: GroupId,
    section: string,
    name: string,
    price: number,
    extra: Partial<MenuItem> = {},
  ) => {
    items.push({
      id: slug(`${section}-${name}`),
      group,
      section,
      name,
      price,
      ...extra,
    })
  }

  const wine = (section: string, name: string, price: number, place: string) =>
    add('wine', section, name, price, { description: place })

  wine('Красное вино', 'Cold Country Zinfandel', 16, 'США, полусухое')
  wine('Красное вино', 'Lama di Pietra Nero di Troia', 16, 'Италия, сухое')
  wine('Красное вино', 'Luccarelli Primitivo Puglia', 17, 'Италия, сухое')
  wine('Красное вино', 'Cono Sur Tocornal Cabernet Sauvignon', 18, 'Чили, сухое')
  wine('Красное вино', 'San Valentin Garnacha', 17, 'Испания, сухое')

  wine('Белое вино', 'Lama di Pietra Chardonnay', 17, 'Италия, сухое')
  wine('Белое вино', 'San Valentin Parellada', 15, 'Испания, полусухое')
  wine('Белое вино', 'Das Ist Gewürztraminer', 15, 'Германия, полусухое')
  wine('Белое вино', 'De Martino Estate Sauvignon Blanc', 17, 'Чили, сухое')
  wine('Белое вино', 'Joya Sauvignon Blanc', 14, 'Португалия, полусухое')
  wine('Белое вино', 'Heinz Eifel Dry Riesling', 14, 'Германия, сухое')
  wine('Белое вино', 'Nau Mai Sauvignon Blanc', 19, 'Новая Зеландия, сухое')

  wine('Игристое', 'Astoria Prosecco Brut', 17, 'Италия, сухое')
  wine('Игристое', 'Astoria Prosecco Rose', 17, 'Италия, сухое')
  wine('Игристое', 'Freixenet Cava', 17, 'Испания, сухое')
  wine('Игристое', 'Dulong Crémant de Bordeaux Brut', 21, 'Франция, брют')

  wine('Розовое вино', 'Luccarelli Puglia Rosado', 19, 'Италия, сухое')
  wine('Розовое вино', 'Hans Baer Pinot Noir Rose', 14, 'Германия, полусухое')
  wine('Розовое вино', '770 Miles White Zinfandel', 16, 'США, полусухое')
  wine('Розовое вино', 'Joya Syrah', 17, 'Португалия, полусухое')

  wine('Безалкогольное вино', 'Pierre Zero Rose', 15, 'Франция, полусладкое')
  wine('Безалкогольное вино', 'Pierre Zero White', 15, 'Франция, полусладкое')
  wine('Безалкогольное вино', 'Pierre Zero Red', 15, 'Франция, полусладкое')
  wine('Безалкогольное вино', 'Pierre Zero Sparkling', 15, 'Франция, полусладкое')

  const pizza = (name: string, price: number, description: string) =>
    add('pizza', 'Пицца', name, price, { description })

  pizza('Чоризо. Мостарда из инжира', 29, 'чоризо / руккола / моцарелла / мостарда из инжира')
  pizza('Три вида томатов. Страчателла', 26, 'желтый томат / томат черри / вяленый томат / песто / трюфельная страчателла')
  pizza('Парма. Клубника', 29, 'парма / клубника / моцарелла / руккола / черный перец')
  pizza('Острая чоризо. Два вида томатов. Халапеньо', 29, 'острая чоризо / желтые томаты / красные томаты / халапеньо / табаско')
  pizza('Пепперони', 28, 'пепперони / моцарелла / черный перец')
  pizza('Авокадо. Фета. Терияки', 29, 'авокадо / фета / терияки / трюфельная страчателла')
  pizza('Грибы. Трюфельный крем', 27, 'вешенки / шампиньоны / трюфельный крем / моцарелла / пармезан')
  pizza('Тартар пицца', 29, 'тартар из говядины / харисса / шпинат / апельсиновое масло / пармезан')
  pizza('Мортаделла. Взбитая рикотта. Фисташка', 29, 'мортаделла / рикотта / масло апельсиновое / фисташка / моцарелла / пармезан')
  pizza('Карбонара', 29, 'бекон / пармезан / маринованный желток')
  pizza('Парма. Груша. Горгонзола', 29, 'парма / груша / горгонзола / руккола / моцарелла')
  pizza('Цыпленок. Бекон. Камамбер', 29, 'цыпленок / бекон / камамбер / моцарелла')

  const bite = (name: string, price: number) =>
    add('snacks', 'Винные закуски', name, price, { weight: '50 г' })

  bite('Салями', 8)
  bite('Вяленая говядина', 8)
  bite('Оливки гиганты', 9)
  bite('Вяленые томаты', 9)
  bite('Оливки кимчи', 9)
  bite('Пармезан', 8)
  bite('Дор блю', 8)
  bite('Горгонзола, маскарпоне, мед', 10)
  bite('Качота с трюфелем', 10)

  const starter = (name: string, price: number, weight: string) =>
    add('snacks', 'Закуски', name, price, { weight })

  starter('Чипсы с чили кремом и лаймом', 9, '50 г')
  starter('Тост с тунцом, овощной джем', 22, '190 г')
  starter('Тост с прошутто, груша', 22, '180 г')
  starter('Тост на гречишном хлебе, лосось', 24, '190 г')
  starter('Тост на гречишном хлебе, авокадо, трюфельный крем', 21, '200 г')
  starter('Фритто мисто', 24, '170 г')
  starter('Крокеты с лососем, васаби соус', 23, '210 г')
  starter('Хумус, креветка темпура, битые огурцы', 21, '240 г')
  starter('Батат фри, пармезан, трюфельный мусс', 17, '150 г')

  const salad = (name: string, price: number, weight: string) =>
    add('salads', 'Салаты', name, price, { weight })

  salad('Цезарь с копченой индейкой', 22, '210 г')
  salad('Салат с прошутто и грушей', 22, '180 г')
  salad('Нисуаз', 24, '265 г')
  salad('Зеленый салат, авокадо, жареный миндаль', 21, '170 г')
  salad('Салат с ростбифом, трюфельный понзу', 27, '230 г')
  salad('Салат с креветкой, авокадо крем', 27, '230 г')

  const raw = (name: string, price: number, weight: string) =>
    add('raw', 'Raw bar', name, price, { weight })

  raw('Открытые роллы с лососем, клубника кимчи', 22, '160 г')
  raw('Открытые роллы с говядиной, трюфельный мусс', 22, '135 г')
  raw('Тартар из говядины, трюфельный мусс', 25, '220 г')
  raw('Тартар из говядины, сливочная харисса', 26, '205 г')
  raw('Тартар из говядины, маринованные шиитаке, картофель пай', 26, '130 г')
  raw('Тартар из лосося, авокадо крем, апельсиновое масло', 28, '150 г')

  const main = (name: string, price: number, weight: string) =>
    add('mains', 'Основные', name, price, { weight })

  main('Бедро цыпленка, пюре батата, шпинат', 32, '280 г')
  main('Ребро, трюфельное пюре, огурцы цукэмоно', 34, '450 г')
  main('Кальмар, трюфельный понзу, домашняя лепешка', 33, '330 г')
  main('Томленая щека, картофельное пюре, шиитаке', 38, '340 г')
  main('Лосось, рис, гуакамоле, крем авокадо', 39, '250 г')
  main('Стейк миньон, картофельное пюре, лисички, шпинат', 42, '410 г')
  main('Филе утки, пюре батата, шпинат', 38, '280 г')
  main('Мидии, сливочный соус, фри', 32, '400 г')
  main('Рисовая лапша, цыпленок', 28, '300 г')
  main('Рисовая лапша, утка', 30, '300 г')
  main('Жареный рис, морепродукты', 29, '340 г')
  main('Бургер BBQ', 28, '400 г')
  main('Double smash бургер', 31, '380 г')

  const poke = (name: string, price: number) => add('mains', 'Поке', name, price, { weight: '400 г' })
  poke('Поке с лососем', 28)
  poke('Поке с креветкой', 28)
  poke('Поке с тунцом', 28)

  add('soups', 'Супы', 'Куриный суп с домашней лапшой', 22, { weight: '450 г' })
  add('soups', 'Супы', 'Том ям', 27, { weight: '450 г' })

  add('sides', 'Гарниры', 'Фри', 7, { weight: '150 г' })
  add('sides', 'Гарниры', 'Пивной хлеб', 3, { weight: '100 г' })
  add('sides', 'Гарниры', 'Бриошь', 3, { weight: '100 г' })
  add('sides', 'Гарниры', 'Гречишный хлеб', 3, { weight: '100 г' })

  add('desserts', 'Десерты', 'Фисташковый наполеон', 19, { weight: '140 г' })
  add('desserts', 'Десерты', 'Миндальная меренга, малина', 18, { weight: '180 г' })
  add('desserts', 'Десерты', 'Шоколадный тарт, вяленая вишня', 17, { weight: '125 г' })

  add('bar', 'Фирменные настойки', 'Вишневая настойка', 4)
  add('bar', 'Фирменные настойки', 'Клюквенная настойка', 4)
  add('bar', 'Фирменные настойки', 'Облепиховая настойка', 4)
  add('bar', 'Фирменные настойки', 'Малиновая настойка', 4)
  add('bar', 'Фирменные настойки', 'Сет из фирменных настоек', 15, { weight: '200 мл' })

  add('bar', 'Коньяк и бренди', 'Арарат 3*', 7)
  add('bar', 'Коньяк и бренди', 'Арарат 5*', 8)
  add('bar', 'Коньяк и бренди', 'Torres Gran Reserve 10*', 11)
  add('bar', 'Коньяк и бренди', 'Hennessy VS', 25)

  add('bar', 'Джин и ром', 'Джин Bickens', 11)
  add('bar', 'Джин и ром', 'Ром Bacardi Carta Blanca', 12)
  add('bar', 'Джин и ром', 'Ром Bacardi Carta Negra', 12)
  add('bar', 'Джин и ром', 'Ром Bacardi Spiced', 12)
  add('bar', 'Джин и ром', 'Ром Bacardi Oro', 12)

  add('bar', 'Виски', "Grant's The Family Reserve", 12)
  add('bar', 'Виски', 'Tullamore D.E.W.', 14)
  add('bar', 'Виски', 'Jim Beam', 11)
  add('bar', 'Виски', "Jack Daniel's", 20)
  add('bar', 'Виски', 'Jameson', 14)
  add('bar', 'Виски', 'Monkey Shoulder', 26)

  add('bar', 'Водка', 'Сябры', 3)
  add('bar', 'Водка', 'Финляндия', 10)
  add('bar', 'Текила', 'Tequila Silver', 10)

  add('bar', 'Разливное пиво', 'Светлое фильтрованное', 7, { description: '0,5 л' })
  add('bar', 'Разливное пиво', 'Темное нефильтрованное', 7, { description: '0,5 л' })
  add('bar', 'Разливное пиво', 'Пшеничное нефильтрованное', 7, { description: '0,5 л' })

  const craft = (name: string) =>
    add('bar', 'Разливное пиво', name, 6, {
      variants: [
        { id: '03', name: '0,3 л', price: 6 },
        { id: '05', name: '0,5 л', price: 9 },
      ],
    })

  craft('Волковская')
  craft('Пивоварня IPA')
  craft('Сидорова коза')
  craft('Сидр вишня, миндаль')

  add('bar', 'Вермут', 'Martini Bianco', 7)
  add('bar', 'Вермут', 'Martini Extra Dry', 7)
  add('bar', 'Вермут', 'Martini Fiero', 7)
  add('bar', 'Вермут', 'Martini Rosso', 7)

  add('drinks', 'Напитки', 'Coca-Cola Zero Sugar', 6)
  add('drinks', 'Напитки', 'Coca-Cola Classic', 6)
  add('drinks', 'Напитки', 'Fanta', 6)
  add('drinks', 'Напитки', 'Sprite', 6)
  add('drinks', 'Напитки', 'Schweppes Indian Tonic', 7)
  add('drinks', 'Напитки', 'Bonaqua', 4)
  add('drinks', 'Напитки', 'Сок Rich', 3)

  add('drinks', 'Лимонады', 'Киви, фейхоа', 12)
  add('drinks', 'Лимонады', 'Персик, личи', 12)
  add('drinks', 'Лимонады', 'Апельсин, земляника', 12)
  add('drinks', 'Лимонады', 'Домашний лимонад', 15, { weight: '1 л' })
  add('drinks', 'Лимонады', 'Персиковый холодный чай', 15, { weight: '1 л' })
  add('drinks', 'Ягодные лимонады', 'Облепиха, маракуйя', 12)
  add('drinks', 'Ягодные лимонады', 'Малина, базилик', 12)

  const coffee = (name: string, price: number) =>
    add('coffee', 'Кофе', name, price, {
      description: 'альтернативное молоко +1,50',
      modifiers: ALT_MILK,
    })

  coffee('Эспрессо', 5)
  coffee('Американо', 5)
  coffee('Капучино', 6)
  coffee('Латте', 6)
  coffee('Матча латте', 7)
  coffee('Флэт уайт', 8)
  coffee('Эспрессо-тоник', 8)
  coffee('Тыквенный айс латте', 9)
  coffee('Гранатовый coffee', 8)
  coffee('Irish coffee', 13)
  coffee('Coconut matcha cloud', 9)
  coffee('Coconut coffee cloud', 9)

  add('tea', 'Чай', 'Классический чай', 7, {
    description: 'чёрный или зелёный',
    variants: [
      { id: 'black', name: 'чёрный', price: 7 },
      { id: 'green', name: 'зелёный', price: 7 },
    ],
  })
  add('tea', 'Чай', 'Молочный улун', 8)
  add('tea', 'Чай', 'Саган дайля', 8)
  add('tea', 'Чай', 'Гречишный чай', 8)
  add('tea', 'Чай', 'Травяной чай', 8, { description: 'саган дайля, малина' })
  add('tea', 'Чай', 'Облепиховый, манго, розмарин', 10)

  return items
}

export const MENU = buildMenu()

const seen = new Set<string>()
for (const item of MENU) {
  if (seen.has(item.id)) throw new Error(`Повторяется id блюда: ${item.id}`)
  seen.add(item.id)
}

export function groupOf(id: GroupId) {
  return GROUPS.find((group) => group.id === id) ?? GROUPS[0]
}
