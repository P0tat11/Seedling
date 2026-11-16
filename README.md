# Seedling
**Track:** Finance
**Team:** Rahul Goplani, Avya Sahu, And Anvesha Anand
# The problem
Young people who want to run a small shop often need help turning an idea into a practical plan: what to sell, how to price it, and how sales connect to a savings goal. Generic advice can be hard to apply, especially when it does not reflect the young person's actual menu, costs, or sales.
# What we built
Seedling is a shop-planning and sales-tracking app for young entrepreneurs. A founder enters an age group, shop details, savings goal, schedule, supply costs, and products; they can then record sales in a register and review revenue, profit, progress, badges, and suggested ways to divide earnings. The AI Coach can answer questions using the saved shop data, current weather, and selected age group.
# How it works
**Data:** There is no fixed training dataset. The app uses shop and sales data entered by each user; the number of records varies by account. The coach receives a structured, type-checked snapshot of the user's shops, products, goals, sales summaries, recent receipts, cart, weather, and age group. Parent contact details and account credentials are excluded. There is no dataset-wide cleaning step because these are live app records; the server limits and normalizes fields before including them in the AI prompt.
**Model:** The AI Coach uses Ollama Cloud through its chat-completions API. The default model is `gemma4:31b`, configurable with the server-side `OLLAMA_MODEL` setting. If Cloud is unavailable, the browser can optionally try Ollama running locally on that user's device (default model `llama3.2`). We use a language model so the coach can respond conversationally while using the founder's current shop context; Seedling does not train or fine-tune a model.
# Results 


# What we'd do next
- Build a reviewed set of realistic shop questions and expected criteria, then evaluate answer relevance, factual accuracy against shop records, and age-appropriate tone across all onboarding age groups.
- Add stronger validation for advice involving prices and profit, and improve the coach's error and retry experience when Ollama Cloud is unavailable.

### Sources

- [Ollama Cloud](https://docs.ollama.com/cloud) and [Ollama API keys](https://docs.ollama.com/cloud/api.md) — hosted model inference.
- [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility) — chat-completions API format.
- [Ollama Cloud models](https://docs.ollama.com/cloud/models.md) — available models; the configured default is `gemma4:31b`.
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs) — live weather data used by the app.
- [Neon](https://neon.tech/docs) — PostgreSQL database; [Vercel](https://vercel.com/docs) — app development and deployment.
- [React](https://react.dev/) and [Tailwind CSS](https://tailwindcss.com/docs) — interface libraries; the app also uses [Babel Standalone](https://babeljs.io/docs/babel-standalone) to compile JSX in the browser.
- AI coding assistance: GitHub Copilot.


