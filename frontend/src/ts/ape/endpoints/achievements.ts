const BASE_PATH = "/achievements";

export default class Achievements {
  constructor(private httpClient: Ape.HttpClient) {
    this.httpClient = httpClient;
  }

  async getAchievements(): Ape.EndpointResponse<Ape.Achievements.GetAchievements> {
    return await this.httpClient.get(BASE_PATH);
  }
}
