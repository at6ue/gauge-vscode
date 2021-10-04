using System;
using FluentAssertions;
using Gauge.CSharp.Lib.Attribute;

namespace netcore.template
{
    public class MultipleEnvironment

    {
        [Step("<key> is loaded")]
        public void keyIsLoaded(string key)
        {
            var actual = Environment.GetEnvironmentVariable(key);
            actual.Should().NotBeNull();
        }

        [Step("<key> is not loaded")]
        public void keyIsNotLoaded(string key)
        {
            Environment.GetEnvironmentVariable(key).Should().BeNull();
        }

    }
}
