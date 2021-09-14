import static org.assertj.core.api.Assertions.assertThat;

import com.thoughtworks.gauge.Step;

public class MultipleEnvironment {

	@Step("<key> is loaded")
	public void isLoaded(String key) {
		assertThat(System.getenv(key)).isNotNull();
	}

	@Step("<key> is not loaded")
	public void isNotLoaded(String key) {
		assertThat(System.getenv(key)).isNull();
	}

}
